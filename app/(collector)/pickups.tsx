import { useFocusEffect } from 'expo-router';
/**
 * Zone Manager Dashboard — Zone Pickups (Section 4)
 *
 * Tabs: Pending | Assigned | In Transit | Completed
 * Actions: Assign/Reassign driver per pickup
 * All filtered by zone_id
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { supabase } from "@/lib/supabase";
import { createDriverNotification } from "@/lib/driver-notification-helper";
import { sendNotification } from "@/lib/send-notification";
import { useJobNotifications } from "@/hooks/use-job-notifications";
import { getStaticResponsive } from "@/hooks/use-responsive";
type PickupStatus = "pending" | "assigned" | "in_transit" | "completed";

interface Pickup {
  id: string;
  customerName: string;
  address: string;
  status: PickupStatus;
  driverId: string | null;
  driverName: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
}

interface Driver {
  id: string;
  name: string;
  isOnline: boolean;
}

const ZONE_GREEN = "#1B5E20";

const STATUS_CONFIG: Record<
  PickupStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  pending: {
    label: "Pending",
    color: "#F59E0B",
    bg: "#FEF3C7",
    icon: "schedule",
  },
  assigned: {
    label: "Assigned",
    color: "#3B82F6",
    bg: "#DBEAFE",
    icon: "assignment-ind",
  },
  in_transit: {
    label: "In Transit",
    color: "#8B5CF6",
    bg: "#EDE9FE",
    icon: "local-shipping",
  },
  completed: {
    label: "Completed",
    color: "#10B981",
    bg: "#D1FAE5",
    icon: "check-circle",
  },
};

export default function ZonePickupsScreen() {
  const colors = useColors();
  const { user } = useAuth();

  const [tab, setTab] = useState<PickupStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  // Native push notification helpers for zone manager
  const { notifyManualAssignment, notifyNewPickupRequest } = useJobNotifications();

  const fetchData = useCallback(
    async (resolvedZoneId?: number) => {
      if (!user?.id) return;
      try {
        let zId = resolvedZoneId ?? zoneId;
        if (!zId) {
          const { data: zoneRow } = await supabase
            .from("zone_collectors")
            .select("zoneId")
            .eq("collectorId", user.id)
            .maybeSingle();
          if (!zoneRow?.zoneId) {
            setLoading(false);
            return;
          }
          zId = zoneRow.zoneId;
          setZoneId(zId);
        }

        // Fetch pickups for this zone
        const { data: pickupData } = await supabase
          .from("pickups")
          .select(
            "id, customerName, address, status, driverId, scheduledAt, completedAt"
          )
          .eq("zoneId", zId)
          .order("scheduledAt", { ascending: false });

        // Fetch driver names
        const driverIds = [
          ...new Set(
            (pickupData ?? [])
              .map((p: any) => p.driverId)
              .filter(Boolean)
          ),
        ];
        let driverMap: Record<string, string> = {};
        if (driverIds.length > 0) {
          const { data: driverData } = await supabase
            .from("driver_profiles")
            .select("id, fullName")
            .in("id", driverIds);
          (driverData ?? []).forEach((d: any) => {
            driverMap[d.id] = d.fullName ?? "Driver";
          });
        }

        setPickups(
          (pickupData ?? []).map((p: any) => ({
            id: p.id.toString(),
            customerName: p.customerName ?? "Customer",
            address: p.address ?? "—",
            status: p.status as PickupStatus,
            driverId: p.driverId?.toString() ?? null,
            driverName: p.driverId ? driverMap[p.driverId] ?? null : null,
            scheduledAt: p.scheduledAt ?? null,
            completedAt: p.completedAt ?? null,
          }))
        );

        // Fetch available drivers
        const { data: driverList } = await supabase
          .from("driver_profiles")
          .select("id, fullName, isOnline")
          .eq("zoneId", zId)
          .eq("status", "approved");

        setDrivers(
          (driverList ?? []).map((d: any) => ({
            id: d.id.toString(),
            name: d.fullName ?? "Driver",
            isOnline: d.isOnline ?? false,
          }))
        );
      } catch (err) {
        console.error("[ZonePickups] fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [user?.id, zoneId]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const openAssignModal = (pickupId: string) => {
    setSelectedPickupId(pickupId);
    setAssignModalVisible(true);
  };

  const assignDriver = async (driverId: string) => {
    if (!selectedPickupId) return;
    setAssigning(true);
    try {
      await supabase
        .from("pickups")
        .update({ driverId, status: "assigned" })
        .eq("id", selectedPickupId);
      // Find the pickup details for the notification body
      const pickup = pickups.find((p) => p.id === selectedPickupId);
      // Notify the assigned driver in real time
      await createDriverNotification({
        driverUserId: driverId,
        type: "pickup_assigned",
        title: "New Pickup Assigned 🚨",
        body: pickup
          ? `You have been assigned a pickup at ${pickup.address} for ${pickup.customerName}.`
          : "You have been assigned a new pickup. Check your dashboard.",
        pickupId: selectedPickupId,
      });
      // Also notify the customer that a driver has been assigned
      if (pickup && (pickup as any).customerId) {
        sendNotification({
          userId: (pickup as any).customerId,
          type: "pickup_update",
          title: "Driver Assigned to Your Pickup",
          body: `A driver has been assigned to your pickup at ${pickup.address}. They will be with you soon.`,
          pickupId: selectedPickupId,
        }).catch(() => {});
      }
      // Fire native push notification to driver device
      const assignedDriver = drivers.find((d) => d.id === driverId);
      if (pickup && assignedDriver) {
        notifyManualAssignment({
          pickupId: selectedPickupId,
          managerName: user?.fullName || user?.firstName || "Zone Manager",
          address: pickup.address,
          customerName: pickup.customerName,
        }).catch(() => {});
      }
      setAssignModalVisible(false);
      await fetchData();
    } catch {
      Alert.alert("Error", "Failed to assign driver.");
    } finally {
      setAssigning(false);
    }
  };

  const tabList: { key: PickupStatus; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "assigned", label: "Assigned" },
    { key: "in_transit", label: "In Transit" },
    { key: "completed", label: "Done" },
  ];

  const filteredPickups = pickups.filter((p) => p.status === tab);

  const renderPickup = ({ item }: { item: Pickup }) => {
    const cfg = STATUS_CONFIG[item.status];
  // Real-time: reload data every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardTop}>
          <View
            style={[styles.statusIcon, { backgroundColor: cfg.bg }]}
          >
            <MaterialIcons
              name={cfg.icon as any}
              size={20}
              color={cfg.color}
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.foreground }]}>
              {item.customerName}
            </Text>
            <Text style={[styles.cardAddress, { color: colors.muted }]}>
              {item.address}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.badgeText, { color: cfg.color }]}>
              {cfg.label}
            </Text>
          </View>
        </View>

        {/* Driver info */}
        <View
          style={[
            styles.driverRow,
            { borderTopColor: colors.border },
          ]}
        >
          <View style={styles.driverInfo}>
            <MaterialIcons
              name="person"
              size={16}
              color={colors.muted}
            />
            <Text style={[styles.driverText, { color: colors.muted }]}>
              {item.driverName ?? "Unassigned"}
            </Text>
          </View>
          {item.scheduledAt && (
            <View style={styles.driverInfo}>
              <MaterialIcons
                name="schedule"
                size={16}
                color={colors.muted}
              />
              <Text style={[styles.driverText, { color: colors.muted }]}>
                {new Date(item.scheduledAt).toLocaleDateString()}
              </Text>
            </View>
          )}
          {(item.status === "pending" || item.status === "assigned") && (
            <TouchableOpacity
              style={[
                styles.assignBtn,
                { backgroundColor: ZONE_GREEN },
              ]}
              onPress={() => openAssignModal(item.id)}
            >
              <Text style={styles.assignBtnText}>
                {item.driverId ? "Reassign" : "Assign"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: ZONE_GREEN }]}>
        <Text style={styles.headerTitle}>Zone Pickups</Text>
        <Text style={styles.headerSub}>
          {filteredPickups.length} {tab.replace("_", " ")} pickup
          {filteredPickups.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {tabList.map((t) => {
          const count = pickups.filter((p) => p.status === t.key).length;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tabItem,
                tab === t.key && {
                  borderBottomColor: ZONE_GREEN,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setTab(t.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: tab === t.key ? ZONE_GREEN : colors.muted,
                    fontWeight: tab === t.key ? "700" : "400",
                  },
                ]}
              >
                {t.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor:
                        tab === t.key ? ZONE_GREEN : colors.muted,
                    },
                  ]}
                >
                  <Text style={styles.countText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator
          color={ZONE_GREEN}
          style={{ marginTop: 40 }}
          size="large"
        />
      ) : (
        <FlatList
          data={filteredPickups}
          keyExtractor={(item) => item.id}
          renderItem={renderPickup}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ZONE_GREEN}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons
                name="delete-sweep"
                size={48}
                color={colors.muted}
              />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No {tab.replace("_", " ")} pickups
              </Text>
            </View>
          }
        />
      )}

      {/* Assign Driver Modal */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, { color: colors.foreground }]}
              >
                Assign Driver
              </Text>
              <TouchableOpacity
                onPress={() => setAssignModalVisible(false)}
              >
                <MaterialIcons
                  name="close"
                  size={24}
                  color={colors.muted}
                />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {drivers.length === 0 ? (
                <Text
                  style={[styles.noDriversText, { color: colors.muted }]}
                >
                  No approved drivers available in your zone.
                </Text>
              ) : (
                drivers.map((driver) => (
                  <TouchableOpacity
                    key={driver.id}
                    style={[
                      styles.driverOption,
                      { borderColor: colors.border },
                    ]}
                    onPress={() => assignDriver(driver.id)}
                    disabled={assigning}
                  >
                    <View
                      style={[
                        styles.driverAvatar,
                        {
                          backgroundColor: driver.isOnline
                            ? "#D1FAE5"
                            : "#F3F4F6",
                        },
                      ]}
                    >
                      <MaterialIcons
                        name="person"
                        size={22}
                        color={
                          driver.isOnline ? ZONE_GREEN : "#9BA1A6"
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.driverOptionName,
                          { color: colors.foreground },
                        ]}
                      >
                        {driver.name}
                      </Text>
                      <View style={styles.onlineRow}>
                        <View
                          style={[
                            styles.onlineDot,
                            {
                              backgroundColor: driver.isOnline
                                ? "#10B981"
                                : "#9BA1A6",
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.onlineText,
                            { color: colors.muted },
                          ]}
                        >
                          {driver.isOnline ? "Online" : "Offline"}
                        </Text>
                      </View>
                    </View>
                    {assigning ? (
                      <ActivityIndicator size="small" color={ZONE_GREEN} />
                    ) : (
                      <MaterialIcons
                        name="chevron-right"
                        size={22}
                        color={colors.muted}
                      />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: _rs.sp(20),
    paddingTop: _rs.sp(20),
    paddingBottom: _rs.sp(20),
  },
  headerTitle: { fontSize: _rs.fs(20), fontWeight: "700", color: "#fff" },
  headerSub: {
    fontSize: _rs.fs(13),
    color: "rgba(255,255,255,0.8)",
    marginTop: _rs.sp(4),
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: _rs.sp(4),
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: _rs.sp(12),
    gap: _rs.sp(5),
  },
  tabText: { fontSize: _rs.fs(13) },
  countBadge: {
    borderRadius: _rs.s(10),
    paddingHorizontal: _rs.sp(5),
    paddingVertical: _rs.sp(1),
    minWidth: 18,
    alignItems: "center",
  },
  countText: { color: "#fff", fontSize: _rs.fs(11), fontWeight: "700" },
  card: {
    borderRadius: _rs.s(14),
    borderWidth: 1,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(14),
    gap: _rs.sp(12),
  },
  statusIcon: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: _rs.fs(15), fontWeight: "600", marginBottom: _rs.sp(2) },
  cardAddress: { fontSize: _rs.fs(13) },
  badge: {
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(4),
    borderRadius: _rs.s(20),
  },
  badgeText: { fontSize: _rs.fs(12), fontWeight: "600" },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(10),
    borderTopWidth: 1,
    gap: _rs.sp(12),
  },
  driverInfo: { flexDirection: "row", alignItems: "center", gap: _rs.sp(5), flex: 1 },
  driverText: { fontSize: _rs.fs(12) },
  assignBtn: {
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(7),
    borderRadius: _rs.s(20),
  },
  assignBtnText: { color: "#fff", fontSize: _rs.fs(13), fontWeight: "600" },
  emptyState: { alignItems: "center", paddingTop: _rs.sp(60), gap: _rs.sp(12) },
  emptyText: { fontSize: _rs.fs(16) },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: _rs.s(24),
    borderTopRightRadius: _rs.s(24),
    padding: _rs.sp(20),
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: _rs.sp(16),
  },
  modalTitle: { fontSize: _rs.fs(18), fontWeight: "700" },
  noDriversText: { textAlign: "center", paddingVertical: _rs.sp(24), fontSize: _rs.fs(15) },
  driverOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: _rs.sp(14),
    borderBottomWidth: 1,
    gap: _rs.sp(12),
  },
  driverAvatar: {
    width: _rs.s(44),
    height: _rs.s(44),
    borderRadius: _rs.s(22),
    justifyContent: "center",
    alignItems: "center",
  },
  driverOptionName: { fontSize: _rs.fs(15), fontWeight: "600", marginBottom: _rs.sp(2) },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(5) },
  onlineDot: { width: _rs.s(8), height: _rs.s(8), borderRadius: _rs.s(4) },
  onlineText: { fontSize: _rs.fs(12) },
});
