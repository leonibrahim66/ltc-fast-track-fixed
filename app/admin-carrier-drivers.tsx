import { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  Platform,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import {useRouter, useFocusEffect} from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useITRealtime } from "@/lib/it-realtime-context";
import { useAdmin } from "@/lib/admin-context";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface DriverRegistration {
  id: string;
  fullName: string;
  phoneNumber: string;
  nrcNumber: string;
  vehicleType: string;
  numberPlate: string;
  vehicleColor: string;
  vehicleModel: string;
  registrationValid: boolean;
  photos: {
    driversLicense: string | null;
    nrcId: string | null;
    vehiclePhoto: string | null;
  };
  registeredAt: string;
  status: "pending_approval" | "approved" | "rejected";
  reviewedAt?: string;
  rejectionReason?: string;
  approvedBy?: string;
}

type TabFilter = "pending" | "approved" | "rejected" | "all";

export default function AdminCarrierDriversScreen() {
  const router = useRouter();
  const { addEvent } = useITRealtime();
  const { addNotification } = useAdmin();
  const [drivers, setDrivers] = useState<DriverRegistration[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>("pending");
  const [selectedDriver, setSelectedDriver] = useState<DriverRegistration | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageLabel, setSelectedImageLabel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await AsyncStorage.getItem("pending_driver_registrations");
      if (data) {
        setDrivers(JSON.parse(data));
      }
    } catch (error) {
      console.error("Failed to load driver registrations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const saveDrivers = async (updatedDrivers: DriverRegistration[]) => {
    try {
      await AsyncStorage.setItem("pending_driver_registrations", JSON.stringify(updatedDrivers));
      setDrivers(updatedDrivers);
    } catch (error) {
      Alert.alert("Error", "Failed to save changes.");
    }
  };

  const handleApprove = (driver: DriverRegistration) => {
    Alert.alert(
      "Approve Driver",
      `Are you sure you want to approve ${driver.fullName} as a carrier driver?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            const updated = drivers.map((d) =>
              d.id === driver.id
                ? {
                    ...d,
                    status: "approved" as const,
                    reviewedAt: new Date().toISOString(),
                    approvedBy: "Admin",
                  }
                : d
            );
            await saveDrivers(updated);
            // Fix 10: Update carrier_driver_accounts so the driver portal reflects approval
            try {
              const accountsStr = await AsyncStorage.getItem("carrier_driver_accounts");
              if (accountsStr) {
                const accounts: DriverRegistration[] = JSON.parse(accountsStr);
                const updatedAccounts = accounts.map((a) =>
                  a.id === driver.id || a.phoneNumber === driver.phoneNumber
                    ? { ...a, status: "approved" as const, reviewedAt: new Date().toISOString(), approvedBy: "Admin" }
                    : a
                );
                await AsyncStorage.setItem("carrier_driver_accounts", JSON.stringify(updatedAccounts));
              }
            } catch (e) {
              console.error("Failed to update carrier_driver_accounts:", e);
            }
            // Fix 10: Emit event to admin live screens and admin notifications
            addEvent({
              type: "driver_approved",
              title: "Driver Approved",
              description: `${driver.fullName} (${driver.vehicleType} • ${driver.numberPlate}) approved as carrier driver`,
              data: { userName: driver.fullName, driverId: driver.id },
              priority: "medium",
            });
            addNotification({
              type: "system",
              title: "Carrier Driver Approved",
              message: `${driver.fullName} has been approved and can now accept carrier jobs`,
            });
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert("Approved", `${driver.fullName} has been approved as a carrier driver. A notification has been sent.`);
            setShowDetailModal(false);
          },
        },
      ]
    );
  };

  const handleReject = () => {
    if (!selectedDriver) return;
    if (!rejectionReason.trim()) {
      Alert.alert("Required", "Please provide a reason for rejection.");
      return;
    }

    const updated = drivers.map((d) =>
      d.id === selectedDriver.id
        ? {
            ...d,
            status: "rejected" as const,
            reviewedAt: new Date().toISOString(),
            rejectionReason: rejectionReason.trim(),
          }
        : d
    );
    saveDrivers(updated);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    Alert.alert("Rejected", `${selectedDriver.fullName}'s application has been rejected. A notification has been sent.`);
    setShowRejectModal(false);
    setShowDetailModal(false);
    setRejectionReason("");
  };

  const filteredDrivers = drivers.filter((d) => {
    const matchesTab = activeTab === "all" || d.status === (activeTab === "pending" ? "pending_approval" : activeTab);
    const matchesSearch =
      !searchQuery.trim() ||
      d.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.phoneNumber.includes(searchQuery) ||
      d.numberPlate.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const counts = {
    pending: drivers.filter((d) => d.status === "pending_approval").length,
    approved: drivers.filter((d) => d.status === "approved").length,
    rejected: drivers.filter((d) => d.status === "rejected").length,
    all: drivers.length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending_approval": return "#F59E0B";
      case "approved": return "#22C55E";
      case "rejected": return "#EF4444";
      default: return "#9BA1A6";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending_approval": return "Pending";
      case "approved": return "Approved";
      case "rejected": return "Rejected";
      default: return status;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-ZM", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openImagePreview = (uri: string | null, label: string) => {
    if (!uri) {
      Alert.alert("No Image", `No ${label} photo was uploaded.`);
      return;
    }
    setSelectedImage(uri);
    setSelectedImageLabel(label);
    setShowImageModal(true);
  };

  const renderDriverCard = ({ item }: { item: DriverRegistration }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedDriver(item);
        setShowDetailModal(true);
      }}
      className="bg-surface rounded-xl p-4 mb-3 mx-4 border border-border"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
            <MaterialIcons name="person" size={20} color="#22C55E" />
          </View>
          <View className="flex-1">
            <Text className="text-foreground font-semibold text-base">{item.fullName}</Text>
            <Text className="text-muted text-xs">{item.phoneNumber}</Text>
          </View>
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: getStatusColor(item.status) + "20" }}
        >
          <Text style={{ color: getStatusColor(item.status), fontSize: 11, fontWeight: "600" }}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <View className="flex-row items-center bg-background/50 rounded-lg px-2 py-1">
          <MaterialIcons name="local-shipping" size={14} color="#9BA1A6" />
          <Text className="text-muted text-xs ml-1">{item.vehicleType}</Text>
        </View>
        <View className="flex-row items-center bg-background/50 rounded-lg px-2 py-1">
          <MaterialIcons name="confirmation-number" size={14} color="#9BA1A6" />
          <Text className="text-muted text-xs ml-1">{item.numberPlate}</Text>
        </View>
        <View className="flex-row items-center bg-background/50 rounded-lg px-2 py-1">
          <MaterialIcons name="schedule" size={14} color="#9BA1A6" />
          <Text className="text-muted text-xs ml-1">{formatDate(item.registeredAt)}</Text>
        </View>
      </View>

      {/* Document indicators */}
      <View className="flex-row mt-3 gap-2">
        <View className="flex-row items-center">
          <MaterialIcons
            name={item.photos.driversLicense ? "check-circle" : "cancel"}
            size={14}
            color={item.photos.driversLicense ? "#22C55E" : "#EF4444"}
          />
          <Text className="text-muted text-xs ml-1">License</Text>
        </View>
        <View className="flex-row items-center">
          <MaterialIcons
            name={item.photos.nrcId ? "check-circle" : "cancel"}
            size={14}
            color={item.photos.nrcId ? "#22C55E" : "#EF4444"}
          />
          <Text className="text-muted text-xs ml-1">NRC/ID</Text>
        </View>
        <View className="flex-row items-center">
          <MaterialIcons
            name={item.photos.vehiclePhoto ? "check-circle" : "cancel"}
            size={14}
            color={item.photos.vehiclePhoto ? "#22C55E" : "#EF4444"}
          />
          <Text className="text-muted text-xs ml-1">Vehicle</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderDetailModal = () => {
    if (!selectedDriver) return null;
  // Real-time: reload data every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDrivers();
    }, [loadDrivers])
  );

    return (
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <ScreenContainer edges={["top", "bottom", "left", "right"]}>
          <View className="flex-row items-center justify-between px-6 pt-4 pb-4 border-b border-border">
            <Text className="text-xl font-bold text-foreground">Driver Details</Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <MaterialIcons name="close" size={24} color="#ECEDEE" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={[selectedDriver]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={() => (
              <View className="px-6 pt-4">
                {/* Status Banner */}
                <View
                  className="rounded-xl p-4 mb-4 flex-row items-center"
                  style={{ backgroundColor: getStatusColor(selectedDriver.status) + "20" }}
                >
                  <MaterialIcons
                    name={
                      selectedDriver.status === "approved"
                        ? "check-circle"
                        : selectedDriver.status === "rejected"
                        ? "cancel"
                        : "hourglass-empty"
                    }
                    size={24}
                    color={getStatusColor(selectedDriver.status)}
                  />
                  <View className="ml-3">
                    <Text style={{ color: getStatusColor(selectedDriver.status), fontWeight: "700", fontSize: 16 }}>
                      {getStatusLabel(selectedDriver.status)}
                    </Text>
                    {selectedDriver.reviewedAt && (
                      <Text className="text-muted text-xs mt-1">
                        Reviewed: {formatDate(selectedDriver.reviewedAt)}
                      </Text>
                    )}
                    {selectedDriver.rejectionReason && (
                      <Text className="text-muted text-xs mt-1">
                        Reason: {selectedDriver.rejectionReason}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Personal Details */}
                <Text className="text-lg font-semibold text-foreground mb-3">Personal Details</Text>
                <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                  <DetailRow label="Full Name" value={selectedDriver.fullName} icon="person" />
                  <DetailRow label="Phone Number" value={selectedDriver.phoneNumber} icon="phone" />
                  <DetailRow label="NRC Number" value={selectedDriver.nrcNumber} icon="badge" />
                  <DetailRow label="Registered" value={formatDate(selectedDriver.registeredAt)} icon="schedule" />
                </View>

                {/* Vehicle Details */}
                <Text className="text-lg font-semibold text-foreground mb-3">Vehicle Details</Text>
                <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                  <DetailRow label="Vehicle Type" value={selectedDriver.vehicleType} icon="local-shipping" />
                  <DetailRow label="Number Plate" value={selectedDriver.numberPlate} icon="confirmation-number" />
                  <DetailRow label="Vehicle Color" value={selectedDriver.vehicleColor} icon="palette" />
                  <DetailRow label="Vehicle Model" value={selectedDriver.vehicleModel} icon="directions-car" />
                  <DetailRow
                    label="Registration Valid"
                    value={selectedDriver.registrationValid ? "Yes" : "No"}
                    icon={selectedDriver.registrationValid ? "check-circle" : "cancel"}
                    valueColor={selectedDriver.registrationValid ? "#22C55E" : "#EF4444"}
                  />
                </View>

                {/* Document Uploads */}
                <Text className="text-lg font-semibold text-foreground mb-3">Uploaded Documents</Text>
                <View className="flex-row gap-3 mb-6">
                  <DocumentThumbnail
                    uri={selectedDriver.photos.driversLicense}
                    label="Driver's License"
                    icon="badge"
                    onPress={() => openImagePreview(selectedDriver.photos.driversLicense, "Driver's License")}
                  />
                  <DocumentThumbnail
                    uri={selectedDriver.photos.nrcId}
                    label="NRC / ID"
                    icon="credit-card"
                    onPress={() => openImagePreview(selectedDriver.photos.nrcId, "NRC / ID")}
                  />
                  <DocumentThumbnail
                    uri={selectedDriver.photos.vehiclePhoto}
                    label="Vehicle"
                    icon="directions-car"
                    onPress={() => openImagePreview(selectedDriver.photos.vehiclePhoto, "Vehicle Photo")}
                  />
                </View>

                {/* Action Buttons */}
                {selectedDriver.status === "pending_approval" && (
                  <View className="gap-3 mb-6">
                    <TouchableOpacity
                      onPress={() => handleApprove(selectedDriver)}
                      className="bg-green-600 rounded-xl py-4 flex-row items-center justify-center"
                    >
                      <MaterialIcons name="check-circle" size={20} color="#fff" />
                      <Text className="text-white font-semibold ml-2 text-base">Approve Driver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setRejectionReason("");
                        setShowRejectModal(true);
                      }}
                      className="bg-red-600 rounded-xl py-4 flex-row items-center justify-center"
                    >
                      <MaterialIcons name="cancel" size={20} color="#fff" />
                      <Text className="text-white font-semibold ml-2 text-base">Reject Application</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedDriver.status === "approved" && (
                  <View className="gap-3 mb-6">
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Suspend Driver",
                          `Are you sure you want to suspend ${selectedDriver.fullName}?`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Suspend",
                              style: "destructive",
                              onPress: async () => {
                                const updated = drivers.map((d) =>
                                  d.id === selectedDriver.id
                                    ? { ...d, status: "rejected" as const, rejectionReason: "Suspended by admin", reviewedAt: new Date().toISOString() }
                                    : d
                                );
                                await saveDrivers(updated);
                                setSelectedDriver({ ...selectedDriver, status: "rejected", rejectionReason: "Suspended by admin" });
                                Alert.alert("Suspended", `${selectedDriver.fullName} has been suspended.`);
                              },
                            },
                          ]
                        );
                      }}
                      className="bg-red-600 rounded-xl py-4 flex-row items-center justify-center"
                    >
                      <MaterialIcons name="block" size={20} color="#fff" />
                      <Text className="text-white font-semibold ml-2 text-base">Suspend Driver</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedDriver.status === "rejected" && (
                  <View className="gap-3 mb-6">
                    <TouchableOpacity
                      onPress={() => handleApprove(selectedDriver)}
                      className="bg-green-600 rounded-xl py-4 flex-row items-center justify-center"
                    >
                      <MaterialIcons name="check-circle" size={20} color="#fff" />
                      <Text className="text-white font-semibold ml-2 text-base">Re-approve Driver</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          />
        </ScreenContainer>
      </Modal>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground">Carrier Driver Approvals</Text>
          <Text className="text-muted text-xs">{drivers.length} total registrations</Text>
        </View>
        <TouchableOpacity onPress={loadDrivers} className="w-10 h-10 rounded-full bg-surface items-center justify-center">
          <MaterialIcons name="refresh" size={20} color="#ECEDEE" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="px-6 mb-4">
        <View className="flex-row items-center bg-surface rounded-xl border border-border px-4">
          <MaterialIcons name="search" size={20} color="#9BA1A6" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, phone, or plate..."
            placeholderTextColor="#9BA1A6"
            className="flex-1 py-3 px-3 text-foreground"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialIcons name="close" size={18} color="#9BA1A6" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab Filters */}
      <View className="flex-row px-6 mb-4 gap-2">
        {(["pending", "approved", "rejected", "all"] as TabFilter[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg items-center ${
              activeTab === tab ? "bg-primary" : "bg-surface border border-border"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                activeTab === tab ? "text-white" : "text-muted"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            <Text
              className={`text-xs ${activeTab === tab ? "text-white/80" : "text-muted/60"}`}
            >
              {counts[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Driver List */}
      <FlatList
        data={filteredDrivers}
        keyExtractor={(item) => item.id}
        renderItem={renderDriverCard}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-16 px-6">
            <MaterialIcons name="local-shipping" size={48} color="#9BA1A6" />
            <Text className="text-foreground font-semibold text-lg mt-4">
              {loading ? "Loading..." : "No Registrations Found"}
            </Text>
            <Text className="text-muted text-sm text-center mt-2">
              {loading
                ? "Fetching driver registrations..."
                : searchQuery
                ? "No drivers match your search criteria."
                : `No ${activeTab === "all" ? "" : activeTab} driver registrations yet.`}
            </Text>
          </View>
        }
      />

      {/* Detail Modal */}
      {renderDetailModal()}

      {/* Rejection Reason Modal */}
      <Modal visible={showRejectModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View className="bg-surface rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-foreground font-bold text-lg mb-2">Reject Application</Text>
            <Text className="text-muted text-sm mb-4">
              Please provide a reason for rejecting {selectedDriver?.fullName}'s application.
            </Text>
            <TextInput
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Enter rejection reason..."
              placeholderTextColor="#9BA1A6"
              multiline
              numberOfLines={4}
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
              style={styles.textArea}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowRejectModal(false)}
                className="flex-1 bg-background border border-border rounded-xl py-3 items-center"
              >
                <Text className="text-foreground font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReject}
                className="flex-1 bg-red-600 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-semibold">Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal visible={showImageModal} transparent animationType="fade">
        <View className="flex-1 bg-black/90 items-center justify-center">
          <View className="w-full px-4">
            <View className="flex-row items-center justify-between mb-4 px-2">
              <Text className="text-white font-semibold text-lg">{selectedImageLabel}</Text>
              <TouchableOpacity onPress={() => setShowImageModal(false)}>
                <MaterialIcons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullImage}
                contentFit="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function DetailRow({
  label,
  value,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  icon: string;
  valueColor?: string;
}) {
  return (
    <View className="flex-row items-center py-3 border-b border-border/30">
      <MaterialIcons name={icon as any} size={18} color="#9BA1A6" />
      <Text className="text-muted text-sm ml-3 flex-1">{label}</Text>
      <Text className="text-foreground font-medium text-sm" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </Text>
    </View>
  );
}

function DocumentThumbnail({
  uri,
  label,
  icon,
  onPress,
}: {
  uri: string | null;
  label: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-1 items-center">
      <View className="w-full aspect-square rounded-xl overflow-hidden bg-surface border border-border items-center justify-center">
        {uri ? (
          <Image source={{ uri }} style={styles.thumbnail} contentFit="cover" />
        ) : (
          <View className="items-center">
            <MaterialIcons name={icon as any} size={28} color="#9BA1A6" />
            <Text className="text-muted text-xs mt-1">No file</Text>
          </View>
        )}
      </View>
      <Text className="text-muted text-xs mt-1 text-center">{label}</Text>
    </TouchableOpacity>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  textArea: {
    color: "#ECEDEE",
    textAlignVertical: "top",
    minHeight: 100,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  fullImage: {
    width: "100%",
    height: _rs.s(400),
    borderRadius: _rs.s(12),
  },
});
