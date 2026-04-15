/**
 * Zone Manager — Driver Management
 *
 * Tabs: Pending | Active | Suspended | Invite Codes
 * Invite Codes use the driver_invite_codes model via InviteCodesContext.
 */
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  Switch,
  TextInput,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { StorageEventBus, STORAGE_KEYS } from "@/lib/storage-event-bus";
import { createDriverNotification } from "@/lib/driver-notification-helper";
import { useJobNotifications } from "@/hooks/use-job-notifications";
import { getStaticResponsive } from "@/hooks/use-responsive";
import {
  useInviteCodes,
  type DriverInviteCode,
  getInviteCodeStatus,
} from "@/lib/invite-codes-context";

type TabType = "pending" | "active" | "suspended" | "invite";

interface GarbageDriver {
  id: string;
  fullName: string;
  phone: string;
  driverStatus: "pending_manager_approval" | "active" | "suspended" | "rejected";
  isOnline?: boolean;
  pickupsToday?: number;
  driverRating?: number;
  nrcNumber?: string;
  driverLicenseNumber?: string;
  vehiclePlateNumber?: string;
  zoneManagerId?: string;
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "No expiry";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusColor(status: ReturnType<typeof getInviteCodeStatus>): string {
  switch (status) {
    case "active":
      return "#22C55E";
    case "expired":
      return "#F59E0B";
    case "disabled":
      return "#9BA1A6";
    case "exhausted":
      return "#EF4444";
  }
}

function statusLabel(status: ReturnType<typeof getInviteCodeStatus>): string {
  switch (status) {
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "disabled":
      return "Disabled";
    case "exhausted":
      return "Limit Reached";
  }
}

async function logActivity(entry: Record<string, unknown>) {
  try {
    const raw = await AsyncStorage.getItem("@ltc_activity_logs");
    const logs: unknown[] = raw ? JSON.parse(raw) : [];
    (logs as Record<string, unknown>[]).unshift({
      id: `log_${Date.now()}`,
      ...entry,
      timestamp: new Date().toISOString(),
    });
    await AsyncStorage.setItem(
      "@ltc_activity_logs",
      JSON.stringify((logs as unknown[]).slice(0, 200))
    );
  } catch (_e) {
    // ignore
  }
}

export default function DriverManagementScreen() {
  const { user } = useAuth();
  const { notifyDriverApproved, notifyDriverRejected } = useJobNotifications();
  const {
    isLoading: codesLoading,
    loadCodes,
    generateCode,
    disableCode,
    deleteCode,
    getCodesByManager,
  } = useInviteCodes();

  const [tab, setTab] = useState<TabType>("pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDrivers, setPendingDrivers] = useState<GarbageDriver[]>([]);
  const [activeDrivers, setActiveDrivers] = useState<GarbageDriver[]>([]);
  const [suspendedDrivers, setSuspendedDrivers] = useState<GarbageDriver[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Generate modal
  const [showGenModal, setShowGenModal] = useState(false);
  const [genUsageLimit, setGenUsageLimit] = useState("");
  const [genHasExpiry, setGenHasExpiry] = useState(false);
  const [genExpiryDays, setGenExpiryDays] = useState("30");
  const [genLoading, setGenLoading] = useState(false);

  const toDriver = (u: Record<string, unknown>): GarbageDriver => ({
    id: u.id as string,
    fullName: (u.fullName as string) || "Unknown",
    phone: (u.phone as string) || "",
    driverStatus:
      (u.driverStatus as GarbageDriver["driverStatus"]) ||
      "pending_manager_approval",
    isOnline: (u.isOnline as boolean) ?? false,
    pickupsToday: (u.pickupsToday as number) ?? 0,
    driverRating: (u.driverRating as number) ?? 0,
    nrcNumber: u.nrcNumber as string | undefined,
    driverLicenseNumber: u.driverLicenseNumber as string | undefined,
    vehiclePlateNumber: u.vehiclePlateNumber as string | undefined,
    zoneManagerId: u.zoneManagerId as string | undefined,
  });

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
      const allUsers: Record<string, unknown>[] = usersRaw
        ? JSON.parse(usersRaw)
        : [];
      const myDrivers = allUsers.filter(
        (u) =>
          u.role === "garbage_driver" &&
(u.zoneManagerId === user.id ||
          (user.zoneId && u.zoneId === user.zoneId))
      );
      setPendingDrivers(
        myDrivers
          .filter((d) => d.driverStatus === "pending_manager_approval")
          .map(toDriver)
      );
      setActiveDrivers(
        myDrivers.filter((d) => d.driverStatus === "active").map(toDriver)
      );
      setSuspendedDrivers(
        myDrivers
          .filter(
            (d) =>
              d.driverStatus === "suspended" || d.driverStatus === "rejected"
          )
          .map(toDriver)
      );
    } catch (_e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.zoneId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
      loadCodes();
    }, [fetchData, loadCodes])
  );

  // Real-time: re-fetch whenever any user data changes (e.g. new driver registers)
  React.useEffect(() => {
    const unsub = StorageEventBus.subscribe(STORAGE_KEYS.USERS_DB, fetchData);
    return unsub;
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    await loadCodes();
    setRefreshing(false);
  };

  // ── Driver actions ──────────────────────────────────────────────────────────

  const handleApprove = async (driver: GarbageDriver) => {
    if (!user?.zoneId) {
      Alert.alert(
        "No Zone Assigned",
        "You must have an active zone assigned before approving drivers."
      );
      return;
    }
    Alert.alert(
      "Approve Driver",
      `Approve ${driver.fullName} as a Garbage Collection Driver?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            setProcessingId(driver.id);
            try {
              const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
              const allUsers: Record<string, unknown>[] = usersRaw
                ? JSON.parse(usersRaw)
                : [];
              const updated = allUsers.map((u) =>
                u.id === driver.id
                  ? {
                      ...u,
                      driverStatus: "active",
                      status: "active",
                      zoneId: user.zoneId,          // camelCase — matches User.zoneId
                      zone_id: user.zoneId,          // legacy snake_case kept for compatibility
                      zoneManagerId: user.id,        // link driver back to their zone manager
                      kycStatus: "verified",
                    }
                  : u
              );
              await AsyncStorage.setItem(
                "@ltc_users_db",
                JSON.stringify(updated)
              );
              // Emit so driver's session and all other screens update in real time
              StorageEventBus.emit(STORAGE_KEYS.USERS_DB);
              await logActivity({
                type: "driver_approved",
                action: "Driver Approved",
                description: `${driver.fullName} approved`,
                adminName: user.fullName,
              });
              // Notify the driver in real time
              await createDriverNotification({
                driverUserId: driver.id,
                type: "driver_approved",
                title: "Application Approved ✅",
                body: `Your application has been approved by ${user.fullName || "your Zone Manager"}. You can now accept pickups.`,
              });
              // Fire native push to driver's device
              notifyDriverApproved({
                managerName: user.fullName || "Zone Manager",
                zoneName: user.zoneId || undefined,
              }).catch(() => {});
              if (Platform.OS !== "web")
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
              await fetchData();
              Alert.alert("Approved", `${driver.fullName} is now active.`);
            } catch (_e) {
              Alert.alert("Error", "Failed to approve driver.");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (driver: GarbageDriver) => {
    Alert.alert(
      "Reject Driver",
      `Reject ${driver.fullName}'s application?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            setProcessingId(driver.id);
            try {
              const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
              const allUsers: Record<string, unknown>[] = usersRaw
                ? JSON.parse(usersRaw)
                : [];
              const updated = allUsers.map((u) =>
                u.id === driver.id
                  ? { ...u, driverStatus: "rejected", status: "rejected" }
                  : u
              );
              await AsyncStorage.setItem(
                "@ltc_users_db",
                JSON.stringify(updated)
              );
              StorageEventBus.emit(STORAGE_KEYS.USERS_DB);
              // Notify the driver in real time
              await createDriverNotification({
                driverUserId: driver.id,
                type: "driver_suspended",
                title: "Application Not Approved",
                body: `Your application was not approved by ${user?.fullName || "your Zone Manager"}. Please contact support for more information.`,
              });
              // Fire native push to driver's device
              notifyDriverRejected({
                managerName: user?.fullName || "Zone Manager",
                reason: "Please contact support for more information.",
              }).catch(() => {});
              if (Platform.OS !== "web")
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error
                );
              await fetchData();
            } catch (_e) {
              Alert.alert("Error", "Failed to reject driver.");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSuspend = async (driver: GarbageDriver) => {
    Alert.alert("Suspend Driver", `Suspend ${driver.fullName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Suspend",
        style: "destructive",
        onPress: async () => {
          setProcessingId(driver.id);
          try {
            const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
            const allUsers: Record<string, unknown>[] = usersRaw
              ? JSON.parse(usersRaw)
              : [];
            const updated = allUsers.map((u) =>
              u.id === driver.id
                ? {
                    ...u,
                    driverStatus: "suspended",
                    status: "suspended",
                    isOnline: false,
                  }
                : u
            );
            await AsyncStorage.setItem(
              "@ltc_users_db",
              JSON.stringify(updated)
            );
            StorageEventBus.emit(STORAGE_KEYS.USERS_DB);
            // Notify the driver in real time
            await createDriverNotification({
              driverUserId: driver.id,
              type: "driver_suspended",
              title: "Account Suspended",
              body: `Your driver account has been suspended by ${user?.fullName || "your Zone Manager"}. Please contact support for assistance.`,
            });
            await fetchData();
          } catch (_e) {
            Alert.alert("Error", "Failed to suspend driver.");
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  };

  const handleReactivate = async (driver: GarbageDriver) => {
    setProcessingId(driver.id);
    try {
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
      const allUsers: Record<string, unknown>[] = usersRaw
        ? JSON.parse(usersRaw)
        : [];
      const updated = allUsers.map((u) =>
        u.id === driver.id
          ? { ...u, driverStatus: "active", status: "active" }
          : u
      );
      await AsyncStorage.setItem("@ltc_users_db", JSON.stringify(updated));
      StorageEventBus.emit(STORAGE_KEYS.USERS_DB);
      // Notify the driver in real time
      await createDriverNotification({
        driverUserId: driver.id,
        type: "driver_approved",
        title: "Account Reactivated ✅",
        body: `Your driver account has been reactivated by ${user?.fullName || "your Zone Manager"}. You can now accept pickups again.`,
      });
      await fetchData();
    } catch (_e) {
      Alert.alert("Error", "Failed to reactivate driver.");
    } finally {
      setProcessingId(null);
    }
  };

  // ── Invite code actions ─────────────────────────────────────────────────────

  const handleGenerateCode = async () => {
    if (!user) return;
    setGenLoading(true);
    try {
      const usageLimit = genUsageLimit.trim()
        ? parseInt(genUsageLimit.trim(), 10)
        : null;
      const expiresAt = genHasExpiry
        ? new Date(
            Date.now() +
              parseInt(genExpiryDays || "30", 10) * 86400000
          ).toISOString()
        : null;
      const newCode = await generateCode({
        zoneManagerId: user.id,
        zoneManagerName: user.fullName ?? "Zone Manager",
        zoneId: user.zoneId ?? null,
        usageLimit:
          usageLimit && !isNaN(usageLimit) ? usageLimit : null,
        expiresAt,
      });
      setShowGenModal(false);
      setGenUsageLimit("");
      setGenHasExpiry(false);
      setGenExpiryDays("30");
      await Clipboard.setStringAsync(newCode.code);
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Code Generated!",
        `Invite code: ${newCode.code}\n\nCopied to clipboard. Share with your driver.`
      );
    } catch (_e) {
      Alert.alert("Error", "Failed to generate invite code.");
    } finally {
      setGenLoading(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert("Copied!", `Code ${code} copied to clipboard.`);
  };

  const handleDisableCode = (ic: DriverInviteCode) => {
    Alert.alert(
      "Disable Code",
      `Disable code ${ic.code}? Drivers will no longer be able to use it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disable",
          style: "destructive",
          onPress: () => disableCode(ic.id),
        },
      ]
    );
  };

  const handleDeleteCode = (ic: DriverInviteCode) => {
    Alert.alert("Delete Code", `Permanently delete code ${ic.code}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteCode(ic.id),
      },
    ]);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const myCodes = user ? getCodesByManager(user.id) : [];

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: pendingDrivers.length },
    { key: "active", label: "Active", count: activeDrivers.length },
    { key: "suspended", label: "Suspended", count: suspendedDrivers.length },
    { key: "invite", label: "Invite Codes", count: myCodes.length },
  ];

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderDriverCard = (
    driver: GarbageDriver,
    actions: React.ReactNode
  ) => (
    <View key={driver.id} style={styles.driverCard}>
      <View style={styles.driverRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {driver.fullName?.charAt(0)?.toUpperCase() ?? "D"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{driver.fullName}</Text>
          <Text style={styles.driverPhone}>{driver.phone}</Text>
          {driver.vehiclePlateNumber && (
            <Text style={styles.driverMeta}>
              Plate: {driver.vehiclePlateNumber}
            </Text>
          )}
          {driver.driverLicenseNumber && (
            <Text style={styles.driverMeta}>
              License: {driver.driverLicenseNumber}
            </Text>
          )}
        </View>
        {processingId === driver.id && (
          <ActivityIndicator size="small" color="#0a7ea4" />
        )}
      </View>
      <View style={styles.driverActions}>{actions}</View>
    </View>
  );

  const renderCodeCard = ({ item: ic }: { item: DriverInviteCode }) => {
    const st = getInviteCodeStatus(ic);
    const color = statusColor(st);
    return (
      <View style={styles.codeCard}>
        <View style={styles.codeTopRow}>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{ic.code}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleCopyCode(ic.code)}
            style={styles.copyBtn}
          >
            <MaterialIcons name="content-copy" size={18} color="#0a7ea4" />
          </TouchableOpacity>
          <View
            style={[styles.statusBadge, { backgroundColor: color + "20" }]}
          >
            <Text style={[styles.statusText, { color }]}>
              {statusLabel(st)}
            </Text>
          </View>
        </View>
        <View style={styles.codeMeta}>
          <View style={styles.codeMetaRow}>
            <MaterialIcons name="people" size={14} color="#687076" />
            <Text style={styles.codeMetaText}>
              {ic.usedCount} used
              {ic.usageLimit !== null
                ? ` / ${ic.usageLimit} limit`
                : " (unlimited)"}
            </Text>
          </View>
          <View style={styles.codeMetaRow}>
            <MaterialIcons name="schedule" size={14} color="#687076" />
            <Text style={styles.codeMetaText}>
              {formatExpiry(ic.expiresAt)}
            </Text>
          </View>
          <View style={styles.codeMetaRow}>
            <MaterialIcons name="calendar-today" size={14} color="#687076" />
            <Text style={styles.codeMetaText}>
              Created {new Date(ic.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <View style={styles.codeActions}>
          {ic.isActive && (
            <TouchableOpacity
              onPress={() => handleDisableCode(ic)}
              style={[styles.codeActionBtn, { borderColor: "#F59E0B" }]}
            >
              <MaterialIcons name="block" size={14} color="#F59E0B" />
              <Text style={[styles.codeActionText, { color: "#F59E0B" }]}>
                Disable
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => handleDeleteCode(ic)}
            style={[styles.codeActionBtn, { borderColor: "#EF4444" }]}
          >
            <MaterialIcons name="delete-outline" size={14} color="#EF4444" />
            <Text style={[styles.codeActionText, { color: "#EF4444" }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Driver Management</Text>
        <Text style={styles.headerSub}>
          {activeDrivers.length} active · {pendingDrivers.length} pending
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
          >
            <Text
              style={[
                styles.tabLabel,
                tab === t.key && styles.tabLabelActive,
              ]}
            >
              {t.label}
            </Text>
            {t.count > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  tab === t.key && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    tab === t.key && styles.tabBadgeTextActive,
                  ]}
                >
                  {t.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1, padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && tab !== "invite" ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#0a7ea4" />
        ) : tab === "pending" ? (
          pendingDrivers.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="hourglass-empty" size={48} color="#9BA1A6" />
              <Text style={styles.emptyTitle}>No Pending Applications</Text>
              <Text style={styles.emptySub}>
                Share an invite code with drivers to receive applications.
              </Text>
            </View>
          ) : (
            pendingDrivers.map((d) =>
              renderDriverCard(
                d,
                <>
                  <TouchableOpacity
                    onPress={() => handleApprove(d)}
                    style={[styles.actionBtn, styles.approveBtn]}
                  >
                    <MaterialIcons name="check" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleReject(d)}
                    style={[styles.actionBtn, styles.rejectBtn]}
                  >
                    <MaterialIcons name="close" size={16} color="#EF4444" />
                    <Text
                      style={[styles.actionBtnText, { color: "#EF4444" }]}
                    >
                      Reject
                    </Text>
                  </TouchableOpacity>
                </>
              )
            )
          )
        ) : tab === "active" ? (
          activeDrivers.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons
                name="directions-car"
                size={48}
                color="#9BA1A6"
              />
              <Text style={styles.emptyTitle}>No Active Drivers</Text>
            </View>
          ) : (
            activeDrivers.map((d) =>
              renderDriverCard(
                d,
                <TouchableOpacity
                  onPress={() => handleSuspend(d)}
                  style={[styles.actionBtn, styles.suspendBtn]}
                >
                  <MaterialIcons name="pause" size={16} color="#F59E0B" />
                  <Text style={[styles.actionBtnText, { color: "#F59E0B" }]}>
                    Suspend
                  </Text>
                </TouchableOpacity>
              )
            )
          )
        ) : tab === "suspended" ? (
          suspendedDrivers.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="check-circle" size={48} color="#9BA1A6" />
              <Text style={styles.emptyTitle}>No Suspended Drivers</Text>
            </View>
          ) : (
            suspendedDrivers.map((d) =>
              renderDriverCard(
                d,
                <TouchableOpacity
                  onPress={() => handleReactivate(d)}
                  style={[styles.actionBtn, styles.approveBtn]}
                >
                  <MaterialIcons name="play-arrow" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Reactivate</Text>
                </TouchableOpacity>
              )
            )
          )
        ) : (
          /* ── Invite Codes Tab ── */
          <View>
            <TouchableOpacity
              onPress={() => setShowGenModal(true)}
              style={styles.generateBtn}
            >
              <MaterialIcons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.generateBtnText}>Generate Invite Code</Text>
            </TouchableOpacity>
            {codesLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color="#0a7ea4" />
            ) : myCodes.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="vpn-key" size={48} color="#9BA1A6" />
                <Text style={styles.emptyTitle}>No Invite Codes</Text>
                <Text style={styles.emptySub}>
                  Generate a code and share it with drivers to link them to
                  your zone.
                </Text>
              </View>
            ) : (
              <FlatList
                data={myCodes.slice().reverse()}
                keyExtractor={(item) => item.id}
                renderItem={renderCodeCard}
                scrollEnabled={false}
                ItemSeparatorComponent={() => (
                  <View style={{ height: 12 }} />
                )}
              />
            )}
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Generate Code Modal */}
      <Modal visible={showGenModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Generate Invite Code</Text>
            <Text style={styles.modalSubtitle}>
              A unique 7-character code will be generated and linked to your
              zone. Share it with the driver during registration.
            </Text>
            <Text style={styles.fieldLabel}>Usage Limit (optional)</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. 5 — leave blank for unlimited"
              placeholderTextColor="#9BA1A6"
              keyboardType="numeric"
              value={genUsageLimit}
              onChangeText={setGenUsageLimit}
              returnKeyType="done"
            />
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Set Expiry Date</Text>
                <Text style={styles.fieldHint}>
                  Code expires after the set number of days
                </Text>
              </View>
              <Switch
                value={genHasExpiry}
                onValueChange={setGenHasExpiry}
                trackColor={{ true: "#0a7ea4" }}
              />
            </View>
            {genHasExpiry && (
              <>
                <Text style={styles.fieldLabel}>Expires In (days)</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="30"
                  placeholderTextColor="#9BA1A6"
                  keyboardType="numeric"
                  value={genExpiryDays}
                  onChangeText={setGenExpiryDays}
                  returnKeyType="done"
                />
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowGenModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleGenerateCode}
                style={styles.modalConfirmBtn}
                disabled={genLoading}
              >
                {genLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    Generate &amp; Copy
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    backgroundColor: "#0a7ea4",
    paddingHorizontal: _rs.sp(20),
    paddingTop: _rs.sp(16),
    paddingBottom: _rs.sp(20),
  },
  headerTitle: { color: "#fff", fontSize: _rs.fs(22), fontWeight: "700" },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: _rs.fs(13), marginTop: _rs.sp(2) },
  tabBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    maxHeight: 52,
  },
  tabBarContent: {
    paddingHorizontal: _rs.sp(16),
    gap: _rs.sp(4),
    alignItems: "center",
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(10),
    borderRadius: _rs.s(20),
    gap: _rs.sp(6),
  },
  tabBtnActive: { backgroundColor: "#E6F4FE" },
  tabLabel: { fontSize: _rs.fs(13), color: "#687076", fontWeight: "500" },
  tabLabelActive: { color: "#0a7ea4", fontWeight: "700" },
  tabBadge: {
    backgroundColor: "#E5E7EB",
    borderRadius: _rs.s(10),
    paddingHorizontal: _rs.sp(6),
    paddingVertical: _rs.sp(1),
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeActive: { backgroundColor: "#0a7ea4" },
  tabBadgeText: { fontSize: _rs.fs(11), color: "#687076", fontWeight: "700" },
  tabBadgeTextActive: { color: "#fff" },
  emptyState: { alignItems: "center", paddingVertical: _rs.sp(48), gap: _rs.sp(8) },
  emptyTitle: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    color: "#11181C",
    marginTop: _rs.sp(8),
  },
  emptySub: {
    fontSize: _rs.fs(13),
    color: "#687076",
    textAlign: "center",
    maxWidth: 260,
  },
  driverCard: {
    backgroundColor: "#fff",
    borderRadius: _rs.s(12),
    padding: _rs.sp(16),
    marginBottom: _rs.sp(12),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: _rs.sp(12),
    marginBottom: _rs.sp(12),
  },
  avatar: {
    width: _rs.s(44),
    height: _rs.s(44),
    borderRadius: _rs.s(22),
    backgroundColor: "#E6F4FE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: _rs.fs(18), fontWeight: "700", color: "#0a7ea4" },
  driverName: { fontSize: _rs.fs(15), fontWeight: "600", color: "#11181C" },
  driverPhone: { fontSize: _rs.fs(13), color: "#687076", marginTop: _rs.sp(2) },
  driverMeta: { fontSize: _rs.fs(12), color: "#9BA1A6", marginTop: _rs.sp(2) },
  driverActions: { flexDirection: "row", gap: _rs.sp(8) },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(8),
    borderRadius: _rs.s(8),
    gap: _rs.sp(4),
    borderWidth: 1,
  },
  approveBtn: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  rejectBtn: { backgroundColor: "#FEF2F2", borderColor: "#EF4444" },
  suspendBtn: { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" },
  actionBtnText: { fontSize: _rs.fs(13), fontWeight: "600", color: "#fff" },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a7ea4",
    borderRadius: _rs.s(12),
    paddingVertical: _rs.sp(14),
    gap: _rs.sp(8),
    marginBottom: _rs.sp(20),
  },
  generateBtnText: { color: "#fff", fontSize: _rs.fs(15), fontWeight: "700" },
  codeCard: {
    backgroundColor: "#fff",
    borderRadius: _rs.s(12),
    padding: _rs.sp(16),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  codeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(10),
    marginBottom: _rs.sp(12),
  },
  codeBox: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    borderRadius: _rs.s(8),
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(8),
  },
  codeText: {
    fontSize: _rs.fs(20),
    fontWeight: "800",
    color: "#11181C",
    letterSpacing: 3,
  },
  copyBtn: {
    width: _rs.s(36),
    height: _rs.s(36),
    borderRadius: _rs.s(8),
    backgroundColor: "#E6F4FE",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: { borderRadius: _rs.s(8), paddingHorizontal: _rs.sp(10), paddingVertical: _rs.sp(4) },
  statusText: { fontSize: _rs.fs(12), fontWeight: "700" },
  codeMeta: { gap: _rs.sp(6), marginBottom: _rs.sp(12) },
  codeMetaRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(6) },
  codeMetaText: { fontSize: _rs.fs(13), color: "#687076" },
  codeActions: {
    flexDirection: "row",
    gap: _rs.sp(8),
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: _rs.sp(12),
  },
  codeActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(4),
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(6),
    borderRadius: _rs.s(8),
    borderWidth: 1,
  },
  codeActionText: { fontSize: _rs.fs(12), fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: _rs.s(20),
    borderTopRightRadius: _rs.s(20),
    padding: _rs.sp(24),
    paddingBottom: _rs.sp(40),
  },
  modalHandle: {
    width: _rs.s(40),
    height: _rs.s(4),
    backgroundColor: "#E5E7EB",
    borderRadius: _rs.s(2),
    alignSelf: "center",
    marginBottom: _rs.sp(20),
  },
  modalTitle: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
    color: "#11181C",
    marginBottom: _rs.sp(8),
  },
  modalSubtitle: {
    fontSize: _rs.fs(14),
    color: "#687076",
    lineHeight: _rs.fs(20),
    marginBottom: _rs.sp(20),
  },
  fieldLabel: {
    fontSize: _rs.fs(13),
    fontWeight: "600",
    color: "#11181C",
    marginBottom: _rs.sp(6),
  },
  fieldHint: { fontSize: _rs.fs(12), color: "#9BA1A6", marginTop: _rs.sp(2) },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: _rs.s(10),
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(12),
    fontSize: _rs.fs(15),
    color: "#11181C",
    marginBottom: _rs.sp(16),
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: _rs.sp(16),
  },
  modalActions: { flexDirection: "row", gap: _rs.sp(12), marginTop: _rs.sp(8) },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: _rs.sp(14),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  modalCancelText: { fontSize: _rs.fs(15), fontWeight: "600", color: "#687076" },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: _rs.sp(14),
    borderRadius: _rs.s(12),
    backgroundColor: "#0a7ea4",
    alignItems: "center",
  },
  modalConfirmText: { fontSize: _rs.fs(15), fontWeight: "700", color: "#fff" },
});
