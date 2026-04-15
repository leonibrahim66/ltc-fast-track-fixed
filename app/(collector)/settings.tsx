/**
 * Zone Manager Dashboard — Settings (Section 6)
 *
 * Allowed: Update profile, update payment details, view assigned zone
 * NOT allowed: Change zone, modify commission %, view other zones
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { supabase } from "@/lib/supabase";

import { getStaticResponsive } from "@/hooks/use-responsive";
const ZONE_GREEN = "#1B5E20";

interface ProfileData {
  fullName: string;
  phone: string;
}

interface ZoneData {
  id: number;
  name: string;
  city: string;
  status: string;
  commissionRate: number;
}

interface PaymentDetails {
  provider: "MTN" | "Airtel" | "Zamtel";
  mobileNumber: string;
}

export default function ZoneManagerSettingsScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: "",
    phone: "",
  });
  const [zoneData, setZoneData] = useState<ZoneData | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    provider: "MTN",
    mobileNumber: "",
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Profile
    setProfileData({
      fullName: user.fullName ?? "",
      phone: user.phone ?? "",
    });

      // Zone
      const { data: zoneRow } = await supabase
        .from("zone_collectors")
        .select("zoneId")
        .eq("collectorId", user.id)
        .maybeSingle();

      if (zoneRow?.zoneId) {
        const { data: zone } = await supabase
          .from("zones")
          .select("id, name, city, status")
          .eq("id", zoneRow.zoneId)
          .maybeSingle();

        const { data: settings } = await supabase
          .from("financial_settings")
          .select("commission_rate")
          .maybeSingle();

        if (zone) {
          setZoneData({
            id: zone.id,
            name: zone.name,
            city: zone.city,
            status: zone.status,
            commissionRate: parseFloat(settings?.commission_rate ?? "10"),
          });
        }
      }

      // Payment details from withdrawal_config
      const { data: payConfig } = await supabase
        .from("withdrawal_config")
        .select("provider, mobile_number")
        .eq("user_id", user.id)
        .maybeSingle();

      if (payConfig) {
        setPaymentDetails({
          provider: payConfig.provider ?? "MTN",
          mobileNumber: payConfig.mobile_number ?? "",
        });
      }
    } catch (err) {
      console.error("[Settings] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveProfile = async () => {
    if (!profileData.fullName.trim()) {
      Alert.alert("Required", "Full name cannot be empty.");
      return;
    }
    setSavingProfile(true);
    try {
      await supabase
        .from("users")
        .update({
          fullName: profileData.fullName.trim(),
          phone: profileData.phone.trim(),
        })
        .eq("id", user?.id);
      Alert.alert("Saved", "Profile updated successfully.");
    } catch {
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePaymentDetails = async () => {
    if (!paymentDetails.mobileNumber.trim()) {
      Alert.alert("Required", "Please enter your mobile money number.");
      return;
    }
    setSavingPayment(true);
    try {
      await supabase.from("withdrawal_config").upsert({
        user_id: user?.id,
        provider: paymentDetails.provider,
        mobile_number: paymentDetails.mobileNumber.trim(),
        updated_at: new Date().toISOString(),
      });
      Alert.alert("Saved", "Payment details updated successfully.");
    } catch {
      Alert.alert("Error", "Failed to update payment details.");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/welcome" as any);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <ActivityIndicator
          color={ZONE_GREEN}
          style={{ marginTop: 60 }}
          size="large"
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: ZONE_GREEN }]}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSub}>Manage your account and preferences</Text>
        </View>

        {/* Zone Info (read-only) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Assigned Zone
          </Text>
          {zoneData ? (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.zoneRow}>
                <View
                  style={[
                    styles.zoneIconWrap,
                    { backgroundColor: "#E8F5E9" },
                  ]}
                >
                  <MaterialIcons name="place" size={24} color={ZONE_GREEN} />
                </View>
                <View style={styles.zoneInfo}>
                  <Text
                    style={[styles.zoneName, { color: colors.foreground }]}
                  >
                    {zoneData.name}
                  </Text>
                  <Text style={[styles.zoneCity, { color: colors.muted }]}>
                    {zoneData.city}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        zoneData.status === "active" ? "#D1FAE5" : "#FEE2E2",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          zoneData.status === "active"
                            ? "#065F46"
                            : "#991B1B",
                      },
                    ]}
                  >
                    {zoneData.status}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.commissionRow,
                  { borderTopColor: colors.border },
                ]}
              >
                <MaterialIcons name="info" size={16} color={colors.muted} />
                <Text style={[styles.commissionText, { color: colors.muted }]}>
                  Platform commission: {zoneData.commissionRate}% (set by
                  admin, not modifiable)
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.noZoneText, { color: colors.muted }]}>
                No zone assigned. Contact admin.
              </Text>
            </View>
          )}
        </View>

        {/* Profile */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Profile
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>
              Full Name
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              value={profileData.fullName}
              onChangeText={(v) =>
                setProfileData((p) => ({ ...p, fullName: v }))
              }
              placeholder="Your full name"
              placeholderTextColor={colors.muted}
              returnKeyType="next"
            />

            <Text
              style={[styles.fieldLabel, { color: colors.muted, marginTop: 12 }]}
            >
              Phone Number
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              value={profileData.phone}
              onChangeText={(v) =>
                setProfileData((p) => ({ ...p, phone: v }))
              }
              placeholder="e.g. 0971234567"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              returnKeyType="done"
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: ZONE_GREEN }]}
              onPress={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Payment Details
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>
              Mobile Money Provider
            </Text>
            <View style={styles.providerRow}>
              {(["MTN", "Airtel", "Zamtel"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.providerBtn,
                    {
                      backgroundColor:
                        paymentDetails.provider === p
                          ? ZONE_GREEN
                          : colors.surface,
                      borderColor:
                        paymentDetails.provider === p
                          ? ZONE_GREEN
                          : colors.border,
                    },
                  ]}
                  onPress={() =>
                    setPaymentDetails((prev) => ({ ...prev, provider: p }))
                  }
                >
                  <Text
                    style={[
                      styles.providerText,
                      {
                        color:
                          paymentDetails.provider === p
                            ? "#fff"
                            : colors.foreground,
                      },
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text
              style={[styles.fieldLabel, { color: colors.muted, marginTop: 12 }]}
            >
              Mobile Number
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              value={paymentDetails.mobileNumber}
              onChangeText={(v) =>
                setPaymentDetails((p) => ({ ...p, mobileNumber: v }))
              }
              placeholder="e.g. 0971234567"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              returnKeyType="done"
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: ZONE_GREEN }]}
              onPress={savePaymentDetails}
              disabled={savingPayment}
            >
              {savingPayment ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Payment Details</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Notifications
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <MaterialIcons
                  name="notifications"
                  size={22}
                  color={ZONE_GREEN}
                />
                <View style={{ marginLeft: 12 }}>
                  <Text
                    style={[styles.switchLabel, { color: colors.foreground }]}
                  >
                    Push Notifications
                  </Text>
                  <Text style={[styles.switchSub, { color: colors.muted }]}>
                    Pickup alerts, driver updates, payments
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: colors.border, true: ZONE_GREEN }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.signOutBtn,
              { borderColor: "#EF4444" },
            ]}
            onPress={handleSignOut}
          >
            <MaterialIcons name="logout" size={20} color="#EF4444" />
            <Text style={[styles.signOutText, { color: "#EF4444" }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  section: { paddingHorizontal: _rs.sp(16), paddingTop: _rs.sp(20) },
  sectionTitle: { fontSize: _rs.fs(17), fontWeight: "700", marginBottom: _rs.sp(12) },
  card: {
    borderRadius: _rs.s(16),
    borderWidth: 1,
    padding: _rs.sp(16),
  },
  zoneRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(12) },
  zoneIconWrap: {
    width: _rs.s(44),
    height: _rs.s(44),
    borderRadius: _rs.s(22),
    justifyContent: "center",
    alignItems: "center",
  },
  zoneInfo: { flex: 1 },
  zoneName: { fontSize: _rs.fs(16), fontWeight: "700", marginBottom: _rs.sp(2) },
  zoneCity: { fontSize: _rs.fs(13) },
  statusBadge: {
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(4),
    borderRadius: _rs.s(20),
  },
  statusText: { fontSize: _rs.fs(12), fontWeight: "600", textTransform: "capitalize" },
  commissionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 1,
    paddingTop: _rs.sp(12),
    marginTop: _rs.sp(12),
    gap: _rs.sp(8),
  },
  commissionText: { fontSize: _rs.fs(12), flex: 1, lineHeight: _rs.fs(18) },
  noZoneText: { textAlign: "center", paddingVertical: _rs.sp(12), fontSize: _rs.fs(14) },
  fieldLabel: { fontSize: _rs.fs(13), marginBottom: _rs.sp(6) },
  input: {
    borderWidth: 1,
    borderRadius: _rs.s(10),
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(11),
    fontSize: _rs.fs(15),
  },
  saveBtn: {
    marginTop: _rs.sp(16),
    paddingVertical: _rs.sp(14),
    borderRadius: _rs.s(12),
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: _rs.fs(15), fontWeight: "700" },
  providerRow: { flexDirection: "row", gap: _rs.sp(10) },
  providerBtn: {
    flex: 1,
    paddingVertical: _rs.sp(10),
    borderRadius: _rs.s(10),
    borderWidth: 1.5,
    alignItems: "center",
  },
  providerText: { fontSize: _rs.fs(14), fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  switchLabel: { fontSize: _rs.fs(15), fontWeight: "600", marginBottom: _rs.sp(2) },
  switchSub: { fontSize: _rs.fs(12) },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: _rs.sp(16),
    borderRadius: _rs.s(14),
    borderWidth: 1.5,
    gap: _rs.sp(10),
  },
  signOutText: { fontSize: _rs.fs(16), fontWeight: "700" },
});
