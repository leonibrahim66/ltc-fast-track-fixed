import { ScrollView, Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface DriverData {
  id: string;
  fullName: string;
  phoneNumber: string;
  status: "pending_approval" | "approved" | "rejected" | "suspended";
  rejectionReason?: string;
  registeredAt: string;
}

export default function ApplicationStatusScreen() {
  const router = useRouter();
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDriverData();
  }, []);

  const loadDriverData = async () => {
    try {
      const activeDriverStr = await AsyncStorage.getItem("active_carrier_driver");
      if (activeDriverStr) {
        const driver = JSON.parse(activeDriverStr);
        setDriverData(driver);
        
        // If status is approved, redirect to dashboard
        if (driver.status === "approved") {
          router.replace("/carrier/portal" as any);
        }
      } else {
        // No active driver, redirect to login
        router.replace("/carrier/register-driver" as any);
      }
    } catch (error) {
      console.error("Failed to load driver data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("active_carrier_driver");
      await AsyncStorage.removeItem("driver_remember_me");
      router.replace("/(auth)/welcome" as any);
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  const getStatusBadge = () => {
    if (!driverData) return null;

    switch (driverData.status) {
      case "pending_approval":
        return (
          <View className="bg-yellow-600/20 border border-yellow-600 rounded-full px-4 py-2 flex-row items-center">
            <MaterialIcons name="schedule" size={20} color="#F59E0B" />
            <Text className="text-yellow-400 font-semibold ml-2">Pending Approval</Text>
          </View>
        );
      case "approved":
        return (
          <View className="bg-green-600/20 border border-green-600 rounded-full px-4 py-2 flex-row items-center">
            <MaterialIcons name="check-circle" size={20} color="#22C55E" />
            <Text className="text-green-400 font-semibold ml-2">Approved</Text>
          </View>
        );
      case "rejected":
        return (
          <View className="bg-red-600/20 border border-red-600 rounded-full px-4 py-2 flex-row items-center">
            <MaterialIcons name="cancel" size={20} color="#EF4444" />
            <Text className="text-red-400 font-semibold ml-2">Rejected</Text>
          </View>
        );
      case "suspended":
        return (
          <View className="bg-gray-600/20 border border-gray-600 rounded-full px-4 py-2 flex-row items-center">
            <MaterialIcons name="block" size={20} color="#9BA1A6" />
            <Text className="text-gray-400 font-semibold ml-2">Suspended</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const getStatusMessage = () => {
    if (!driverData) return "";

    switch (driverData.status) {
      case "pending_approval":
        return "Your application is under review. You will receive a notification once approved.";
      case "approved":
        return "Congratulations! Your application has been approved. You can now access your dashboard.";
      case "rejected":
        return driverData.rejectionReason
          ? `Your application was rejected: ${driverData.rejectionReason}`
          : "Your application was rejected. Please contact support for more details.";
      case "suspended":
        return "Your account has been suspended. Please contact admin for assistance.";
      default:
        return "";
    }
  };

  const getStatusIcon = () => {
    if (!driverData) return "info";

    switch (driverData.status) {
      case "pending_approval":
        return "hourglass-empty";
      case "approved":
        return "verified";
      case "rejected":
        return "error-outline";
      case "suspended":
        return "block";
      default:
        return "info";
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <MaterialIcons name="hourglass-empty" size={48} color="#9BA1A6" />
        <Text className="text-muted text-base mt-4">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6">
          <Text className="text-2xl font-bold text-foreground">Application Submitted</Text>
        </View>

        {/* Status Card */}
        <View className="px-6 mb-6">
          <View className="bg-surface border border-border rounded-2xl p-6">
            {/* Status Icon */}
            <View className="items-center mb-6">
              <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center mb-4">
                <MaterialIcons name={getStatusIcon() as any} size={48} color="#0a7ea4" />
              </View>
              {getStatusBadge()}
            </View>

            {/* Driver Info */}
            {driverData && (
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-border">
                  <Text className="text-sm text-muted">Full Name</Text>
                  <Text className="text-sm font-semibold text-foreground">{driverData.fullName}</Text>
                </View>
                <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-border">
                  <Text className="text-sm text-muted">Phone Number</Text>
                  <Text className="text-sm font-semibold text-foreground">{driverData.phoneNumber}</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Submitted On</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {new Date(driverData.registeredAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            )}

            {/* Status Message */}
            <View className="bg-background rounded-xl p-4">
              <Text className="text-sm text-foreground leading-6">{getStatusMessage()}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {driverData?.status === "pending_approval" && (
          <View className="px-6 mb-6">
            <View className="bg-blue-600/10 border border-blue-600 rounded-2xl p-4">
              <View className="flex-row items-start">
                <MaterialIcons name="info" size={20} color="#60A5FA" />
                <View className="flex-1 ml-3">
                  <Text className="text-sm font-semibold text-blue-400 mb-1">What happens next?</Text>
                  <Text className="text-xs text-blue-300 leading-5">
                    Our admin team will review your application and documents. This usually takes 1-2 business days. You will receive a notification once your application is approved.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {driverData?.status === "rejected" && (
          <View className="px-6 mb-6">
            <TouchableOpacity
              onPress={() => router.push("/carrier/create-account" as any)}
              className="bg-blue-600 rounded-lg py-4 items-center flex-row justify-center"
            >
              <MaterialIcons name="refresh" size={20} color="#fff" />
              <Text className="text-white font-semibold text-base ml-2">Reapply</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Logout Button */}
        <View className="px-6 mb-6">
          <TouchableOpacity
            onPress={handleLogout}
            className="border border-red-600 rounded-lg py-4 items-center flex-row justify-center"
          >
            <MaterialIcons name="logout" size={20} color="#EF4444" />
            <Text className="text-red-400 font-semibold text-base ml-2">Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({});
