/**
 * Garbage Collection Driver — My Pickups Screen
 *
 * Shows pickups filtered by:
 *   - zone_id = driver's zone
 *   - assignedDriverId = driver's id
 *
 * Tabs: Assigned | In Progress | Completed
 * Status flow: pending → assigned → accepted → in_progress → completed → confirmed
 *
 * Security: no cross-zone access, no logistics/financial access.
 */
import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
  ScrollView,
  Linking,
  Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { optimizeGarbageRoute, formatRouteDistance, formatRouteDuration, type GarbageOptimizedRoute, type RoutePickup } from "@/lib/route-optimization-service";
import { triggerDriverArrivalAlert, pickupStatusToAlertEvent } from "@/lib/driver-arrival-alerts";
import { StorageEventBus, STORAGE_KEYS } from "@/lib/storage-event-bus";
import { trpc } from "@/lib/trpc";

import { getStaticResponsive } from "@/hooks/use-responsive";
import { sendNotification } from "@/lib/send-notification";
import { useGlobalNotifications } from "@/lib/global-notification-context";
import { useJobNotifications } from "@/hooks/use-job-notifications";
import { useDriverZone } from "@/hooks/useDriverZone";
const DRIVER_ORANGE = "#EA580C";
const STORAGE_KEY = "@ltc_pickups";
const DRIVER_STATUS_KEY = "@ltc_driver_status";
const GMAPS_API_KEY_STORAGE = "@ltc_gmaps_api_key";

export type PickupStatus =
  | "pending"
  | "assigned"
  | "accepted"
  | "in_progress"
  | "completed"
  | "confirmed"
  | "cancelled";

export interface Pickup {
  id: string;
  householdName: string;
  address: string;
  zoneId: string;
  status: PickupStatus;
  assignedDriverId?: string;
  scheduledDate?: string;
  completedAt?: string;
  notes?: string;
  subscriptionStatus?: "active" | "expired" | "overdue";
  latitude?: number;
  longitude?: number;
  contactPhone?: string;
  contactName?: string;
}

type PickupTab = "assigned" | "in_progress" | "completed";

const TAB_CONFIG: { key: PickupTab; label: string; icon: string; statuses: PickupStatus[] }[] = [
  { key: "assigned", label: "Assigned", icon: "assignment", statuses: ["assigned", "accepted"] },
  { key: "in_progress", label: "In Progress", icon: "local-shipping", statuses: ["in_progress"] },
  { key: "completed", label: "Completed", icon: "check-circle", statuses: ["completed", "confirmed"] },
];

const STATUS_COLORS: Record<PickupStatus, string> = {
  pending: "#9BA1A6",
  assigned: "#3B82F6",
  accepted: "#8B5CF6",
  in_progress: "#F59E0B",
  completed: "#22C55E",
  confirmed: "#16A34A",
  cancelled: "#EF4444",
};

const STATUS_LABELS: Record<PickupStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  accepted: "Accepted",
  in_progress: "In Progress",
  completed: "Completed",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export default function GarbageDriverPickupsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { isInZone } = useDriverZone();
  const [tab, setTab] = useState<PickupTab>("assigned");
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<Pickup | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const isPendingApproval = user?.driverStatus === "pending_manager_approval";
  const [optimizedRoute, setOptimizedRoute] = useState<GarbageOptimizedRoute | null>(null);

  // Redirect to waiting screen if pending approval
  useEffect(() => {
    if (isPendingApproval) {
      router.replace("/(garbage-driver)/waiting-approval");
    }
  }, [isPendingApproval, router]);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeVisible, setRouteVisible] = useState(false);

  // Notification bell — from global real-time notification provider
  const { unreadCount: unreadNotifCount } = useGlobalNotifications();
  // Native push notification helpers
  const {
    notifyDriverAccepted,
    notifyDriverArriving,
    notifyPickupCompleted,
  } = useJobNotifications({ unreadCount: unreadNotifCount });

  const loadPickups = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      let all: Pickup[] = raw ? JSON.parse(raw) : [];

      // Zone intelligence: strictly enforce zone boundary — only show pickups
      // where pickup.zoneId exactly matches the driver's assigned zoneId.
      let filtered = all.filter(
        (p) =>
          p.assignedDriverId === user.id &&
          isInZone(p.zoneId)
      );

      setPickups(filtered);
    } catch (_e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.zoneId]);

  useFocusEffect(
    useCallback(() => {
      loadPickups();
    }, [loadPickups])
  );

  // Real-time: when zone manager approves/rejects this driver, the user session
  // is refreshed automatically via auth-context's StorageEventBus subscription.
  // We also reload pickups when USERS_DB changes (e.g. new assignments).
  useEffect(() => {
    const unsub = StorageEventBus.subscribe(STORAGE_KEYS.USERS_DB, loadPickups);
    return unsub;
  }, [loadPickups]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPickups();
    setRefreshing(false);
  };

  const updatePickupStatus = async (pickup: Pickup, newStatus: PickupStatus) => {
    if (!user?.id) return;
    setProcessingId(pickup.id);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: Pickup[] = raw ? JSON.parse(raw) : [];
      const updated = all.map((p) =>
        p.id === pickup.id
          ? {
              ...p,
              status: newStatus,
              completedAt: newStatus === "completed" ? new Date().toISOString() : p.completedAt,
              // When driver accepts, stamp their contact details onto the pickup record
              ...(newStatus === "accepted" || newStatus === "in_progress"
                ? {
                    assignedDriverId: user.id,
                    assignedDriverName: user.fullName || user.firstName || "Driver",
                    driverPhone: (user as any).phone || (user as any).phoneNumber || "",
                    driverVehicleType: (user as any).vehicleType || (user as any).vehicle_type || "Garbage Truck",
                    collectorId: user.id,
                    collectorName: user.fullName || user.firstName || "Driver",
                  }
                : {}),
            }
          : p
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Log to activity logs
      const logsRaw = await AsyncStorage.getItem("@ltc_activity_logs");
      const logs = logsRaw ? JSON.parse(logsRaw) : [];
      const eventMap: Partial<Record<PickupStatus, string>> = {
        accepted: "pickup_assigned",
        in_progress: "pickup_started",
        completed: "pickup_completed",
      };
      const eventType = eventMap[newStatus];
      if (eventType) {
        logs.unshift({
          id: `log_${Date.now()}`,
          adminId: user.id,
          adminName: user.fullName || user.firstName || "Driver",
          adminRole: "garbage_driver",
          type: eventType,
          action: `Pickup ${STATUS_LABELS[newStatus]}`,
          description: `${pickup.householdName} — ${pickup.address}`,
          targetId: pickup.id,
          targetType: "pickup",
          metadata: { zoneId: pickup.zoneId, driverId: user.id },
          timestamp: new Date().toISOString(),
        });
        await AsyncStorage.setItem("@ltc_activity_logs", JSON.stringify(logs.slice(0, 500)));
      }

      // Update driver online status
      if (newStatus === "in_progress") {
        const dsRaw = await AsyncStorage.getItem(DRIVER_STATUS_KEY);
        const ds = dsRaw ? JSON.parse(dsRaw) : {};
        ds[user.id] = { ...ds[user.id], isOnline: true, lastUpdated: new Date().toISOString() };
        await AsyncStorage.setItem(DRIVER_STATUS_KEY, JSON.stringify(ds));
      }

      // Fire customer arrival alert for this status transition
      const alertEvent = pickupStatusToAlertEvent(newStatus);
      if (alertEvent) {
        const driverName = user.fullName || user.firstName || "Driver";
        await triggerDriverArrivalAlert(alertEvent, {
          pickupId: pickup.id,
          householdName: pickup.householdName,
          address: pickup.address,
          driverName,
          driverPhone: user.phone,
        });
      }

      // Notify the customer about the driver's status change
      const customerId = (pickup as any).userId || (pickup as any).customerId || (pickup as any).ownerId;
      const driverDisplayName = user.fullName || user.firstName || "Your driver";
      if (customerId) {
        const notifMap: Partial<Record<PickupStatus, { type: import("@/lib/send-notification").NotifType; title: string; body: string }>> = {
          accepted: {
            type: "driver_accepted",
            title: "Driver Accepted Your Pickup",
            body: `${driverDisplayName} has accepted your pickup request and is on the way.`,
          },
          in_progress: {
            type: "driver_arriving",
            title: "Driver Is On The Way",
            body: `${driverDisplayName} has started your pickup and is heading to your location.`,
          },
          completed: {
            type: "pickup_completed",
            title: "Pickup Completed",
            body: `Your garbage pickup has been completed by ${driverDisplayName}. Thank you!`,
          },
        };
        const notifPayload = notifMap[newStatus];
        if (notifPayload) {
          sendNotification({ userId: customerId, pickupId: pickup.id, ...notifPayload }).catch(() => {});
        }
      }
      // Also fire native device push notifications (works when app is in background/closed)
      const driverName = user.fullName || user.firstName || "Driver";
      if (newStatus === "accepted") {
        notifyDriverAccepted({ pickupId: pickup.id, driverName }).catch(() => {});
      } else if (newStatus === "in_progress") {
        notifyDriverArriving({ pickupId: pickup.id, driverName, etaMinutes: 10 }).catch(() => {});
      } else if (newStatus === "completed") {
        notifyPickupCompleted({ pickupId: pickup.id, driverName }).catch(() => {});
      }

      setPickups((prev) =>
        prev.map((p) =>
          p.id === pickup.id
            ? {
                ...p,
                status: newStatus,
                completedAt: newStatus === "completed" ? new Date().toISOString() : p.completedAt,
              }
            : p
        )
      );

      if (newStatus === "in_progress") {
        setDetailVisible(false);
        router.push("/(garbage-driver)/map" as any);
      }

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_e) {
      Alert.alert("Error", "Failed to update pickup status. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleOptimizeRoute = async () => {
    const activePickups = pickups.filter(
      (p) => ["assigned", "accepted", "in_progress"].includes(p.status) && p.latitude && p.longitude
    );
    if (activePickups.length === 0) {
      Alert.alert("No GPS Pickups", "None of your active pickups have GPS coordinates. Add pickup locations to use route optimization.");
      return;
    }
    setIsOptimizing(true);
    try {
      // Try to get stored Google Maps API key
      const storedKey = await AsyncStorage.getItem(GMAPS_API_KEY_STORAGE);
      const apiKey = storedKey || undefined;

      // Use driver's last known location or Lusaka centre
      const dsRaw = await AsyncStorage.getItem(DRIVER_STATUS_KEY);
      const ds = dsRaw ? JSON.parse(dsRaw) : {};
      const driverEntry = user?.id ? ds[user.id] : null;
      const driverLocation = driverEntry
        ? { latitude: driverEntry.latitude, longitude: driverEntry.longitude }
        : { latitude: -15.4166, longitude: 28.2833 }; // Lusaka centre

      const routePickups: RoutePickup[] = activePickups.map((p) => ({
        id: p.id,
        householdName: p.householdName,
        address: p.address,
        latitude: p.latitude!,
        longitude: p.longitude!,
        status: p.status,
      }));

      const result = await optimizeGarbageRoute(driverLocation, routePickups, apiKey);
      setOptimizedRoute(result);
      setRouteVisible(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_e) {
      Alert.alert("Error", "Failed to optimise route. Please try again.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const filteredPickups = pickups.filter((p) => {
    const cfg = TAB_CONFIG.find((t) => t.key === tab);
    return cfg ? cfg.statuses.includes(p.status) : false;
  });

  const openDetail = (pickup: Pickup) => {
    setSelectedPickup(pickup);
    setDetailVisible(true);
  };

  const renderPickupCard = ({ item }: { item: Pickup }) => {
    const isProcessing = processingId === item.id;
    const subColor =
      item.subscriptionStatus === "active"
        ? "#22C55E"
        : item.subscriptionStatus === "overdue"
        ? "#EF4444"
        : "#F59E0B";

    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(item)} activeOpacity={0.8}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.householdName} numberOfLines={1}>{item.householdName}</Text>
              <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + "20" }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
              {STATUS_LABELS[item.status]}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          {item.subscriptionStatus && (
            <View style={[styles.metaChip, { backgroundColor: subColor + "18" }]}>
              <MaterialIcons name="card-membership" size={12} color={subColor} />
              <Text style={[styles.metaChipText, { color: subColor }]}>
                {item.subscriptionStatus.charAt(0).toUpperCase() + item.subscriptionStatus.slice(1)}
              </Text>
            </View>
          )}
          {item.scheduledDate && (
            <View style={styles.metaChip}>
              <MaterialIcons name="schedule" size={12} color="#9BA1A6" />
              <Text style={styles.metaChipText}>
                {new Date(item.scheduledDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          )}
          {item.latitude != null && item.longitude != null && (
            <View style={styles.metaChip}>
              <MaterialIcons name="location-on" size={12} color="#9BA1A6" />
              <Text style={styles.metaChipText}>GPS</Text>
            </View>
          )}
        </View>

        {item.notes && (
          <Text style={styles.notes} numberOfLines={1}>📝 {item.notes}</Text>
        )}

        {/* Communication panel — shown when driver has accepted or started the pickup */}
        {(item.status === "accepted" || item.status === "in_progress") && (
          <View style={styles.commPanel}>
            <View style={styles.commContact}>
              <View style={styles.commAvatar}>
                <MaterialIcons name="person" size={18} color="#1B4332" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.commName}>{item.contactName || item.householdName}</Text>
                {item.contactPhone ? (
                  <Text style={styles.commPhone}>{item.contactPhone}</Text>
                ) : null}
                <Text style={styles.commAddress} numberOfLines={1}>{item.address}</Text>
              </View>
            </View>
            <View style={styles.commBtns}>
              <TouchableOpacity
                style={[styles.commBtn, { backgroundColor: "#1B4332" }]}
                onPress={() => {
                  if (item.contactPhone) Linking.openURL(`tel:${item.contactPhone}`);
                }}
                disabled={!item.contactPhone}
              >
                <MaterialIcons name="call" size={16} color="#fff" />
                <Text style={styles.commBtnText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.commBtn, { backgroundColor: "#0F766E" }]}
                onPress={() => {
                  if (item.contactPhone) Linking.openURL(`sms:${item.contactPhone}`);
                }}
                disabled={!item.contactPhone}
              >
                <MaterialIcons name="sms" size={16} color="#fff" />
                <Text style={styles.commBtnText}>SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.commBtn, { backgroundColor: "#2563EB" }]}
                onPress={() =>
                  router.push({
                    pathname: "/pickup-chat" as any,
                    params: {
                      pickupId: item.id,
                      otherName: item.contactName || item.householdName,
                      otherPhone: item.contactPhone || "",
                    },
                  })
                }
              >
                <MaterialIcons name="chat" size={16} color="#fff" />
                <Text style={styles.commBtnText}>Chat</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.cardActions}>
          {item.status === "assigned" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#8B5CF6" }]}
              onPress={() => updatePickupStatus(item, "accepted")}
              disabled={isProcessing}
            >
              {isProcessing ? <ActivityIndicator size="small" color="white" /> : (
                <>
                  <MaterialIcons name="thumb-up" size={14} color="white" />
                  <Text style={styles.actionBtnText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {item.status === "accepted" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: DRIVER_ORANGE }]}
              onPress={() => updatePickupStatus(item, "in_progress")}
              disabled={isProcessing}
            >
              {isProcessing ? <ActivityIndicator size="small" color="white" /> : (
                <>
                  <MaterialIcons name="local-shipping" size={14} color="white" />
                  <Text style={styles.actionBtnText}>Start</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {item.status === "in_progress" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#22C55E" }]}
              onPress={() => updatePickupStatus(item, "completed")}
              disabled={isProcessing}
            >
              {isProcessing ? <ActivityIndicator size="small" color="white" /> : (
                <>
                  <MaterialIcons name="check-circle" size={14} color="white" />
                  <Text style={styles.actionBtnText}>Complete</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#334155" }]}
            onPress={() => openDetail(item)}
          >
            <MaterialIcons name="info" size={14} color="white" />
            <Text style={styles.actionBtnText}>Details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Show pending approval screen for all pending drivers (dev and production)
  if (isPendingApproval) {
    return (
      <ScreenContainer>
        <View style={styles.pendingScreen}>
          <View style={styles.pendingIconWrap}>
            <MaterialIcons name="hourglass-empty" size={56} color={DRIVER_ORANGE} />
          </View>
          <Text style={styles.pendingTitle}>Awaiting Approval</Text>
          <Text style={styles.pendingSubtitle}>
            Your application has been submitted to your Zone Manager.{"\n\n"}You will be notified as soon as your account is approved. This page updates automatically.
          </Text>
          <View style={styles.pendingInfoCard}>
            <MaterialIcons name="info-outline" size={18} color="#0a7ea4" style={{ marginRight: 8 }} />
            <Text style={styles.pendingInfoText}>
              If you have not heard back, contact your Zone Manager directly.
            </Text>
          </View>
          <ActivityIndicator size="small" color={DRIVER_ORANGE} style={{ marginTop: 24 }} />
          <Text style={styles.pendingWaitText}>Checking status…</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Pickups</Text>
          <Text style={styles.headerSub}>
            {pickups.length} pickup{pickups.length !== 1 ? "s" : ""} in your zone
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: "#22C55E" }]}
            onPress={handleOptimizeRoute}
            disabled={isOptimizing}
          >
            {isOptimizing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <MaterialIcons name="alt-route" size={18} color="white" />
            )}
            <Text style={styles.headerBtnText}>Route</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: DRIVER_ORANGE }]}
            onPress={() => router.push("/(garbage-driver)/map" as any)}
          >
            <MaterialIcons name="map" size={18} color="white" />
            <Text style={styles.headerBtnText}>Map</Text>
          </TouchableOpacity>
          {/* Notification Bell — 3rd button */}
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push("/(garbage-driver)/notifications" as any)}
          >
            <MaterialIcons name="notifications" size={22} color="white" />
            {unreadNotifCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        {TAB_CONFIG.map((t) => {
          const count = pickups.filter((p) => t.statuses.includes(p.status)).length;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <MaterialIcons
                name={t.icon as any}
                size={16}
                color={tab === t.key ? DRIVER_ORANGE : "#9BA1A6"}
              />
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, tab === t.key && { backgroundColor: DRIVER_ORANGE }]}>
                  <Text style={styles.tabBadgeText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={DRIVER_ORANGE} />
        </View>
      ) : filteredPickups.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="inbox" size={48} color="#334155" />
          <Text style={styles.emptyTitle}>No pickups here</Text>
          <Text style={styles.emptySubtitle}>
            {tab === "assigned"
              ? "No pickups assigned to you yet."
              : tab === "in_progress"
              ? "No active pickups right now."
              : "No completed pickups yet."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPickups}
          keyExtractor={(item) => item.id}
          renderItem={renderPickupCard}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DRIVER_ORANGE} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Route Optimization Modal */}
      <Modal visible={routeVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setRouteVisible(false)} style={styles.modalClose}>
              <MaterialIcons name="close" size={24} color="#9BA1A6" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Optimised Route</Text>
            <TouchableOpacity
              style={styles.routeMapBtn}
              onPress={() => {
                setRouteVisible(false);
                router.push("/(garbage-driver)/map" as any);
              }}
            >
              <MaterialIcons name="map" size={18} color={DRIVER_ORANGE} />
            </TouchableOpacity>
          </View>

          {optimizedRoute && (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Summary */}
              <View style={styles.routeSummaryRow}>
                <View style={styles.routeSummaryCard}>
                  <MaterialIcons name="straighten" size={18} color="#3B82F6" />
                  <Text style={styles.routeSummaryValue}>{formatRouteDistance(optimizedRoute.totalDistanceMetres)}</Text>
                  <Text style={styles.routeSummaryLabel}>Total Distance</Text>
                </View>
                <View style={styles.routeSummaryCard}>
                  <MaterialIcons name="schedule" size={18} color="#22C55E" />
                  <Text style={styles.routeSummaryValue}>{formatRouteDuration(optimizedRoute.totalDurationMinutes)}</Text>
                  <Text style={styles.routeSummaryLabel}>Est. Duration</Text>
                </View>
                <View style={styles.routeSummaryCard}>
                  <MaterialIcons name="place" size={18} color={DRIVER_ORANGE} />
                  <Text style={styles.routeSummaryValue}>{optimizedRoute.orderedPickups.length}</Text>
                  <Text style={styles.routeSummaryLabel}>Stops</Text>
                </View>
              </View>

              {!optimizedRoute.optimizedByApi && (
                <View style={styles.fallbackBanner}>
                  <MaterialIcons name="info" size={14} color="#92400E" />
                  <Text style={styles.fallbackBannerText}>
                    Using estimated route (Google Maps API key not configured)
                  </Text>
                </View>
              )}

              {/* Ordered pickup sequence */}
              <Text style={styles.sectionTitle}>Pickup Sequence</Text>
              {optimizedRoute.legs.map((leg, i) => (
                <View key={leg.pickupId} style={styles.routeStopCard}>
                  <View style={styles.routeStopNum}>
                    <Text style={styles.routeStopNumText}>{leg.sequence}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeStopName}>{leg.householdName}</Text>
                    <Text style={styles.routeStopAddress} numberOfLines={1}>{leg.address}</Text>
                    <View style={styles.routeStopMeta}>
                      <MaterialIcons name="straighten" size={12} color="#9BA1A6" />
                      <Text style={styles.routeStopMetaText}>{leg.distanceText}</Text>
                      <MaterialIcons name="schedule" size={12} color="#9BA1A6" />
                      <Text style={styles.routeStopMetaText}>{leg.durationText}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.routeStopNav}
                    onPress={() => {
                      const p = optimizedRoute.orderedPickups[i];
                      Linking.openURL(`https://maps.google.com/?q=${p.latitude},${p.longitude}`);
                    }}
                  >
                    <MaterialIcons name="navigation" size={18} color={DRIVER_ORANGE} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.fullBtn, { backgroundColor: DRIVER_ORANGE, marginTop: 8 }]}
                onPress={() => {
                  setRouteVisible(false);
                  router.push("/(garbage-driver)/map" as any);
                }}
              >
                <MaterialIcons name="map" size={18} color="white" />
                <Text style={styles.fullBtnText}>Open Live Map</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Pickup Detail Modal */}
      <Modal visible={detailVisible} animationType="slide" presentationStyle="pageSheet">
        {selectedPickup && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setDetailVisible(false)} style={styles.modalClose}>
                <MaterialIcons name="close" size={24} color="#9BA1A6" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Pickup Details</Text>
              <View style={{ width: 40 }} />
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={[styles.statusCard, { borderColor: STATUS_COLORS[selectedPickup.status] }]}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[selectedPickup.status], width: 12, height: 12 }]} />
                <Text style={[styles.statusCardText, { color: STATUS_COLORS[selectedPickup.status] }]}>
                  {STATUS_LABELS[selectedPickup.status]}
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Household</Text>
                <View style={styles.infoRow}>
                  <MaterialIcons name="home" size={18} color="#9BA1A6" />
                  <Text style={styles.infoText}>{selectedPickup.householdName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="location-on" size={18} color="#9BA1A6" />
                  <Text style={styles.infoText}>{selectedPickup.address}</Text>
                </View>
                {selectedPickup.subscriptionStatus && (
                  <View style={styles.infoRow}>
                    <MaterialIcons name="card-membership" size={18} color="#9BA1A6" />
                    <Text style={styles.infoText}>
                      Subscription:{" "}
                      <Text
                        style={{
                          color:
                            selectedPickup.subscriptionStatus === "active"
                              ? "#22C55E"
                              : selectedPickup.subscriptionStatus === "overdue"
                              ? "#EF4444"
                              : "#F59E0B",
                          fontWeight: "600",
                        }}
                      >
                        {selectedPickup.subscriptionStatus.charAt(0).toUpperCase() +
                          selectedPickup.subscriptionStatus.slice(1)}
                      </Text>
                    </Text>
                  </View>
                )}
                {selectedPickup.notes && (
                  <View style={styles.infoRow}>
                    <MaterialIcons name="note" size={18} color="#9BA1A6" />
                    <Text style={styles.infoText}>{selectedPickup.notes}</Text>
                  </View>
                )}
              </View>

              {selectedPickup.latitude != null && selectedPickup.longitude != null && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Location</Text>
                  <View style={styles.infoRow}>
                    <MaterialIcons name="gps-fixed" size={18} color="#9BA1A6" />
                    <Text style={styles.infoText}>
                      {selectedPickup.latitude.toFixed(5)}, {selectedPickup.longitude.toFixed(5)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.mapLinkBtn}
                    onPress={() => {
                      const url = `https://maps.google.com/?q=${selectedPickup.latitude},${selectedPickup.longitude}`;
                      Linking.openURL(url);
                    }}
                  >
                    <MaterialIcons name="open-in-new" size={16} color={DRIVER_ORANGE} />
                    <Text style={styles.mapLinkText}>Open in Maps</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedPickup.scheduledDate && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Schedule</Text>
                  <View style={styles.infoRow}>
                    <MaterialIcons name="schedule" size={18} color="#9BA1A6" />
                    <Text style={styles.infoText}>
                      {new Date(selectedPickup.scheduledDate).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}

              {selectedPickup.contactPhone && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Contact</Text>
                  <View style={styles.commRow}>
                    <TouchableOpacity
                      style={[styles.commBtn, { backgroundColor: "#22C55E" }]}
                      onPress={() => Linking.openURL(`tel:${selectedPickup.contactPhone}`)}
                    >
                      <MaterialIcons name="call" size={20} color="white" />
                      <Text style={styles.commBtnText}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.commBtn, { backgroundColor: "#3B82F6" }]}
                      onPress={() => {
                        setDetailVisible(false);
                        router.push({
                          pathname: "/(garbage-driver)/chat",
                          params: {
                            pickupId: selectedPickup.id,
                            householdName: selectedPickup.householdName,
                          },
                        } as any);
                      }}
                    >
                      <MaterialIcons name="chat" size={20} color="white" />
                      <Text style={styles.commBtnText}>Chat</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Actions</Text>
                {selectedPickup.status === "assigned" && (
                  <TouchableOpacity
                    style={[styles.fullBtn, { backgroundColor: "#8B5CF6" }]}
                    onPress={() => {
                      updatePickupStatus(selectedPickup, "accepted");
                      setDetailVisible(false);
                    }}
                    disabled={processingId === selectedPickup.id}
                  >
                    <MaterialIcons name="thumb-up" size={18} color="white" />
                    <Text style={styles.fullBtnText}>Accept Pickup</Text>
                  </TouchableOpacity>
                )}
                {selectedPickup.status === "accepted" && (
                  <TouchableOpacity
                    style={[styles.fullBtn, { backgroundColor: DRIVER_ORANGE }]}
                    onPress={() => updatePickupStatus(selectedPickup, "in_progress")}
                    disabled={processingId === selectedPickup.id}
                  >
                    <MaterialIcons name="local-shipping" size={18} color="white" />
                    <Text style={styles.fullBtnText}>Start Pickup — Open Map</Text>
                  </TouchableOpacity>
                )}
                {selectedPickup.status === "in_progress" && (
                  <TouchableOpacity
                    style={[styles.fullBtn, { backgroundColor: "#22C55E" }]}
                    onPress={() => {
                      updatePickupStatus(selectedPickup, "completed");
                      setDetailVisible(false);
                    }}
                    disabled={processingId === selectedPickup.id}
                  >
                    <MaterialIcons name="check-circle" size={18} color="white" />
                    <Text style={styles.fullBtnText}>Mark as Completed</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  devBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(8),
    gap: _rs.sp(8),
  },
  devBannerText: { color: "#92400E", fontSize: _rs.fs(12), flex: 1, fontWeight: "500" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(14),
    borderBottomWidth: 0.5,
    borderBottomColor: "#334155",
  },
  headerTitle: { color: "#ECEDEE", fontSize: _rs.fs(20), fontWeight: "700" },
  headerSub: { color: "#9BA1A6", fontSize: _rs.fs(13), marginTop: _rs.sp(2) },
  mapBtn: { backgroundColor: DRIVER_ORANGE, borderRadius: _rs.s(10), padding: _rs.sp(8) },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#1e2022",
    borderBottomWidth: 0.5,
    borderBottomColor: "#334155",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: _rs.sp(10),
    gap: _rs.sp(4),
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: DRIVER_ORANGE },
  tabLabel: { color: "#9BA1A6", fontSize: _rs.fs(12), fontWeight: "500" },
  tabLabelActive: { color: DRIVER_ORANGE },
  tabBadge: {
    backgroundColor: "#334155",
    borderRadius: _rs.s(8),
    paddingHorizontal: _rs.sp(5),
    paddingVertical: _rs.sp(1),
    minWidth: 18,
    alignItems: "center",
  },
  tabBadgeText: { color: "white", fontSize: _rs.fs(10), fontWeight: "700" },
  list: { padding: _rs.sp(12), gap: _rs.sp(10) },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: _rs.sp(12) },
  emptyTitle: { color: "#ECEDEE", fontSize: _rs.fs(16), fontWeight: "600" },
  emptySubtitle: {
    color: "#9BA1A6",
    fontSize: _rs.fs(13),
    textAlign: "center",
    paddingHorizontal: _rs.sp(32),
  },
  card: {
    backgroundColor: "#1e2022",
    borderRadius: _rs.s(14),
    padding: _rs.sp(14),
    borderWidth: 0.5,
    borderColor: "#334155",
    gap: _rs.sp(8),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), flex: 1 },
  statusDot: { width: _rs.s(10), height: _rs.s(10), borderRadius: _rs.s(5) },
  householdName: { color: "#ECEDEE", fontSize: _rs.fs(15), fontWeight: "600" },
  address: { color: "#9BA1A6", fontSize: _rs.fs(12), marginTop: _rs.sp(2) },
  statusBadge: { borderRadius: _rs.s(8), paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3) },
  statusText: { fontSize: _rs.fs(11), fontWeight: "600" },
  cardMeta: { flexDirection: "row", gap: _rs.sp(6), flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(3),
    backgroundColor: "#334155",
    borderRadius: _rs.s(6),
    paddingHorizontal: _rs.sp(6),
    paddingVertical: _rs.sp(3),
  },
  metaChipText: { color: "#9BA1A6", fontSize: _rs.fs(11) },
  notes: { color: "#9BA1A6", fontSize: _rs.fs(12), fontStyle: "italic" },
  cardActions: { flexDirection: "row", gap: _rs.sp(8), marginTop: _rs.sp(4) },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(4),
    borderRadius: _rs.s(8),
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(6),
  },
  actionBtnText: { color: "white", fontSize: _rs.fs(12), fontWeight: "600" },
  modal: { flex: 1, backgroundColor: "#151718" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(14),
    borderBottomWidth: 0.5,
    borderBottomColor: "#334155",
  },
  modalClose: { padding: _rs.sp(4) },
  modalTitle: { color: "#ECEDEE", fontSize: _rs.fs(17), fontWeight: "700" },
  modalBody: { flex: 1, padding: _rs.sp(16) },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(8),
    borderWidth: 1.5,
    borderRadius: _rs.s(10),
    padding: _rs.sp(12),
    marginBottom: _rs.sp(16),
  },
  statusCardText: { fontSize: _rs.fs(15), fontWeight: "700" },
  section: { marginBottom: _rs.sp(20) },
  sectionTitle: {
    color: "#9BA1A6",
    fontSize: _rs.fs(12),
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: _rs.sp(10),
  },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: _rs.sp(10), marginBottom: _rs.sp(8) },
  infoText: { color: "#ECEDEE", fontSize: _rs.fs(14), flex: 1, lineHeight: _rs.fs(20) },
  mapLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(6),
    marginTop: _rs.sp(4),
    paddingVertical: _rs.sp(6),
  },
  mapLinkText: { color: DRIVER_ORANGE, fontSize: _rs.fs(13), fontWeight: "600" },
  commRow: { flexDirection: "row", gap: _rs.sp(12) },
  commBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: _rs.sp(8),
    borderRadius: _rs.s(12),
    paddingVertical: _rs.sp(12),
  },
  commBtnText: { color: "white", fontSize: _rs.fs(14), fontWeight: "600" },
  fullBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: _rs.sp(8),
    borderRadius: _rs.s(12),
    paddingVertical: _rs.sp(14),
    marginBottom: _rs.sp(10),
  },
  fullBtnText: { color: "white", fontSize: _rs.fs(15), fontWeight: "700" },
  // Header action buttons
  headerActions: { flexDirection: "row", gap: _rs.sp(8) },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(4),
    borderRadius: _rs.s(10),
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(8),
  },
  headerBtnText: { color: "white", fontSize: _rs.fs(12), fontWeight: "600" },
  // Notification bell button in header
  bellBtn: {
    width: _rs.s(38),
    height: _rs.s(38),
    borderRadius: _rs.s(10),
    backgroundColor: "#1B4332",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  // Route optimization modal
  routeMapBtn: { padding: _rs.sp(4) },
  routeSummaryRow: { flexDirection: "row", gap: _rs.sp(8), marginBottom: _rs.sp(16) },
  routeSummaryCard: {
    flex: 1,
    backgroundColor: "#1e2022",
    borderRadius: _rs.s(12),
    padding: _rs.sp(12),
    alignItems: "center",
    gap: _rs.sp(4),
    borderWidth: 0.5,
    borderColor: "#334155",
  },
  routeSummaryValue: { color: "#ECEDEE", fontSize: _rs.fs(16), fontWeight: "700" },
  routeSummaryLabel: { color: "#9BA1A6", fontSize: _rs.fs(10), textAlign: "center" },
  fallbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(6),
    backgroundColor: "#FEF3C7",
    borderRadius: _rs.s(8),
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(6),
    marginBottom: _rs.sp(16),
  },
  fallbackBannerText: { color: "#92400E", fontSize: _rs.fs(11), flex: 1 },
  routeStopCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(12),
    backgroundColor: "#1e2022",
    borderRadius: _rs.s(12),
    padding: _rs.sp(12),
    marginBottom: _rs.sp(8),
    borderWidth: 0.5,
    borderColor: "#334155",
  },
  routeStopNum: {
    width: _rs.s(28),
    height: _rs.s(28),
    borderRadius: _rs.s(14),
    backgroundColor: DRIVER_ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  routeStopNumText: { color: "white", fontSize: _rs.fs(13), fontWeight: "700" },
  routeStopName: { color: "#ECEDEE", fontSize: _rs.fs(14), fontWeight: "600", marginBottom: _rs.sp(2) },
  routeStopAddress: { color: "#9BA1A6", fontSize: _rs.fs(12), marginBottom: _rs.sp(4) },
  routeStopMeta: { flexDirection: "row", alignItems: "center", gap: _rs.sp(4) },
  routeStopMetaText: { color: "#9BA1A6", fontSize: _rs.fs(11), marginRight: _rs.sp(6) },
  routeStopNav: { padding: _rs.sp(6) },
  // Communication panel
  commPanel: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 10,
    gap: 8,
  },
  commContact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  commAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B4332',
  },
  commPhone: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '500',
    marginTop: 1,
  },
  commAddress: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  commBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  pendingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  pendingIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pendingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#11181C',
    marginBottom: 12,
    textAlign: 'center',
  },
  pendingSubtitle: {
    fontSize: 14,
    color: '#687076',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  pendingInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E6F4FE',
    borderRadius: 10,
    padding: 14,
    maxWidth: 320,
  },
  pendingInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#0a7ea4',
    lineHeight: 20,
  },
  pendingWaitText: {
    fontSize: 12,
    color: '#9BA1A6',
    marginTop: 8,
  },
});
