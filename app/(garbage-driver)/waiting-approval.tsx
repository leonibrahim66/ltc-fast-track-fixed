/**
 * Garbage Driver — Waiting for Manager Approval Screen
 *
 * Shown when driver has registered but is pending manager approval.
 * Displays:
 * - Manager name and contact
 * - Approval status
 * - Estimated approval time
 * - Contact manager button
 * - Logout button
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ManagerInfo {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  zone?: string;
}

export default function WaitingForApprovalScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const colors = useColors();

  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<ManagerInfo | null>(null);
  const [registeredAt, setRegisteredAt] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);

  // Check if driver is approved
  const checkApprovalStatus = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Get current user status
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("driverStatus, createdAt")
        .eq("id", user.id)
        .single();

      if (userError) {
        console.error("[WaitingApproval] Get user error:", userError);
        return;
      }

      // If approved, navigate to home
      if (userData?.driverStatus === "active") {
        setIsApproved(true);
        Alert.alert(
          "Approved!",
          "Your profile has been approved by your zone manager. You can now start accepting pickups.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(garbage-driver)"),
            },
          ]
        );
        return;
      }

      // Get manager info
      const driverProfile = await AsyncStorage.getItem("@ltc_driver_profile");
      if (driverProfile) {
        const profile = JSON.parse(driverProfile);
        const { data: managerData, error: managerError } = await supabase
          .from("users")
          .select("id, fullName, phone, email")
          .eq("id", profile.zoneManagerId)
          .single();

        if (!managerError && managerData) {
          setManager({
            id: managerData.id,
            fullName: managerData.fullName || "Zone Manager",
            phone: managerData.phone || "",
            email: managerData.email,
          });
        }
      }

      setRegisteredAt(userData?.createdAt || new Date().toISOString());
    } catch (error) {
      console.error("[WaitingApproval] Check status error:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Check approval status on mount and every 10 seconds
  useFocusEffect(
    useCallback(() => {
      checkApprovalStatus();
      const interval = setInterval(checkApprovalStatus, 10000);
      return () => clearInterval(interval);
    }, [checkApprovalStatus])
  );

  const handleContactManager = () => {
    if (!manager?.phone) {
      Alert.alert("Error", "Manager phone number not available");
      return;
    }

    Alert.alert(
      "Contact Manager",
      `Call ${manager.fullName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call",
          onPress: () => Linking.openURL(`tel:${manager.phone}`),
        },
        {
          text: "WhatsApp",
          onPress: () => Linking.openURL(`whatsapp://send?phone=${manager.phone}`),
        },
      ]
    );
  };

  const handleLogout = async () => {
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
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#1B5E20" />
        <Text style={{ color: colors.muted, marginTop: 16 }}>
          Checking approval status...
        </Text>
      </ScreenContainer>
    );
  }

  if (isApproved) {
    return null; // Will navigate automatically
  }

  const estimatedTime = registeredAt
    ? new Date(new Date(registeredAt).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()
    : "24 hours";

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* Illustration */}
        <View
          style={{
            height: 200,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            marginTop: 32,
          }}
        >
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: "#E8F5E9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcons name="hourglass-empty" size={60} color="#1B5E20" />
          </View>
        </View>

        {/* Title */}
        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: colors.foreground,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Awaiting Approval
        </Text>

        {/* Subtitle */}
        <Text
          style={{
            fontSize: 14,
            color: colors.muted,
            textAlign: "center",
            marginBottom: 24,
            lineHeight: 20,
          }}
        >
          Your profile has been submitted to your zone manager for review and approval.
        </Text>

        {/* Status Card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            borderLeftWidth: 4,
            borderLeftColor: "#F59E0B",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <MaterialIcons name="info" size={20} color="#F59E0B" />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.foreground,
                marginLeft: 8,
              }}
            >
              Current Status
            </Text>
          </View>
          <Text
            style={{
              fontSize: 13,
              color: colors.muted,
              lineHeight: 20,
            }}
          >
            Your profile is pending review. Typically, approvals are completed within 24 hours. You'll receive a notification once approved.
          </Text>
        </View>

        {/* Manager Info */}
        {manager && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.muted,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Your Zone Manager
            </Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.foreground,
                marginBottom: 4,
              }}
            >
              {manager.fullName}
            </Text>
            {manager.phone && (
              <Text
                style={{
                  fontSize: 13,
                  color: colors.muted,
                }}
              >
                📞 {manager.phone}
              </Text>
            )}
          </View>
        )}

        {/* What's Next */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.foreground,
              marginBottom: 12,
            }}
          >
            What's Next?
          </Text>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "#1B5E20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                  Manager Reviews Your Profile
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  Your zone manager will verify your documents and information
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "#1B5E20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                  Approval or Request for Changes
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  You'll receive a notification with the decision
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "#1B5E20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>3</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                  Start Accepting Pickups
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  Once approved, you can start accepting garbage collection jobs
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Buttons */}
        <View style={{ gap: 12 }}>
          {manager && (
            <TouchableOpacity
              style={{
                backgroundColor: "#1B5E20",
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: "center",
              }}
              onPress={handleContactManager}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                Contact Manager
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
            }}
            onPress={handleLogout}
          >
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
