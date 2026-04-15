import { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { CarrierBottomNav } from "@/components/carrier-bottom-nav";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getStaticResponsive } from "@/hooks/use-responsive";
import { useAuth } from "@/lib/auth-context";
interface DriverData {
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

interface AdditionalVehicle {
  id: string;
  vehicleType: string;
  numberPlate: string;
  vehicleColor: string;
  vehicleModel: string;
  addedAt: string;
}

export default function DriverProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [additionalVehicles, setAdditionalVehicles] = useState<AdditionalVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showEditVehicleModal, setShowEditVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<{
    vehicleType: string;
    numberPlate: string;
    vehicleColor: string;
    vehicleModel: string;
  }>({
    vehicleType: "Truck",
    numberPlate: "",
    vehicleColor: "",
    vehicleModel: "",
  });
  const [newVehicle, setNewVehicle] = useState({
    vehicleType: "Truck",
    numberPlate: "",
    vehicleColor: "",
    vehicleModel: "",
  });
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showEditDropdown, setShowEditDropdown] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageLabel, setSelectedImageLabel] = useState("");

  const VEHICLE_TYPES = ["Truck", "Van", "Pickup", "Motorbike"];

  const loadDriverData = useCallback(async () => {
    setLoading(true);
    try {
      // Load driver registration data
      const regData = await AsyncStorage.getItem("driver_registration");
      if (regData) {
        const parsed = JSON.parse(regData);
        // Check against pending list for latest status
        const listData = await AsyncStorage.getItem("pending_driver_registrations");
        if (listData) {
          const list = JSON.parse(listData);
          const match = list.find((d: DriverData) => d.id === parsed.id);
          if (match) {
            setDriver(match);
          } else {
            setDriver(parsed);
          }
        } else {
          setDriver(parsed);
        }
      }

      // Load additional vehicles
      const vehiclesData = await AsyncStorage.getItem("additional_vehicles");
      if (vehiclesData) {
        setAdditionalVehicles(JSON.parse(vehiclesData));
      }
    } catch (error) {
      console.error("Failed to load driver data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDriverData();
  }, [loadDriverData]);

  const handleUpdateVehicle = async () => {
    if (!driver) return;
    if (!editingVehicle.numberPlate.trim() || !editingVehicle.vehicleColor.trim() || !editingVehicle.vehicleModel.trim()) {
      Alert.alert("Validation Error", "All vehicle fields are required.");
      return;
    }

    try {
      const updatedDriver = {
        ...driver,
        vehicleType: editingVehicle.vehicleType,
        numberPlate: editingVehicle.numberPlate,
        vehicleColor: editingVehicle.vehicleColor,
        vehicleModel: editingVehicle.vehicleModel,
      };

      await AsyncStorage.setItem("driver_registration", JSON.stringify(updatedDriver));

      // Also update in pending list
      const listData = await AsyncStorage.getItem("pending_driver_registrations");
      if (listData) {
        const list = JSON.parse(listData);
        const updated = list.map((d: DriverData) =>
          d.id === driver.id ? { ...d, ...editingVehicle } : d
        );
        await AsyncStorage.setItem("pending_driver_registrations", JSON.stringify(updated));
      }

      setDriver(updatedDriver);
      setShowEditVehicleModal(false);
      Alert.alert("Updated", "Vehicle information has been updated successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to update vehicle information.");
    }
  };

  const handleAddVehicle = async () => {
    if (!newVehicle.numberPlate.trim() || !newVehicle.vehicleColor.trim() || !newVehicle.vehicleModel.trim()) {
      Alert.alert("Validation Error", "All vehicle fields are required.");
      return;
    }

    try {
      const vehicle: AdditionalVehicle = {
        id: `vehicle_${Date.now()}`,
        ...newVehicle,
        addedAt: new Date().toISOString(),
      };

      const updated = [...additionalVehicles, vehicle];
      await AsyncStorage.setItem("additional_vehicles", JSON.stringify(updated));
      setAdditionalVehicles(updated);
      setShowAddVehicleModal(false);
      setNewVehicle({ vehicleType: "Truck", numberPlate: "", vehicleColor: "", vehicleModel: "" });
      Alert.alert("Added", "Additional vehicle has been added to your profile.");
    } catch (error) {
      Alert.alert("Error", "Failed to add vehicle.");
    }
  };

  const handleRemoveVehicle = (vehicleId: string) => {
    Alert.alert("Remove Vehicle", "Are you sure you want to remove this vehicle?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const updated = additionalVehicles.filter((v) => v.id !== vehicleId);
          await AsyncStorage.setItem("additional_vehicles", JSON.stringify(updated));
          setAdditionalVehicles(updated);
        },
      },
    ]);
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
      case "pending_approval": return "Pending Review";
      case "approved": return "Approved";
      case "rejected": return "Rejected";
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending_approval": return "hourglass-empty";
      case "approved": return "check-circle";
      case "rejected": return "cancel";
      default: return "help";
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-ZM", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <Text className="text-foreground text-lg">Loading profile...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!driver) {
    return (
      <ScreenContainer>
        <View className="px-6 pt-4 pb-4 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground">Driver Profile</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <MaterialIcons name="person-off" size={64} color="#9BA1A6" />
          <Text className="text-foreground font-semibold text-lg mt-4">No Registration Found</Text>
          <Text className="text-muted text-sm text-center mt-2">
            You haven't registered as a carrier driver yet.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/carrier/register-driver" as any)}
            className="bg-primary rounded-xl py-3 px-8 mt-6"
          >
            <Text className="text-white font-semibold">Register Now</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const sections = [
    { type: "status" },
    { type: "personal" },
    { type: "documents" },
    { type: "primary-vehicle" },
    { type: "additional-vehicles" },
    { type: "rating" },
  ];

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground">Driver Profile</Text>
          <Text className="text-muted text-xs">Manage your carrier driver account</Text>
        </View>
        <TouchableOpacity onPress={loadDriverData} className="w-10 h-10 rounded-full bg-surface items-center justify-center">
          <MaterialIcons name="refresh" size={20} color="#ECEDEE" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.type}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => {
          switch (item.type) {
            case "status":
              return (
                <View className="px-6 mb-4">
                  {/* Profile Header */}
                  <View className="bg-surface rounded-2xl p-6 border border-border items-center">
                    <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center mb-3">
                      <MaterialIcons name="person" size={40} color="#22C55E" />
                    </View>
                    <Text className="text-foreground font-bold text-xl">{driver.fullName}</Text>
                    <Text className="text-muted text-sm mt-1">{driver.phoneNumber}</Text>

                    {/* Status Badge */}
                    <View
                      className="flex-row items-center mt-4 px-4 py-2 rounded-full"
                      style={{ backgroundColor: getStatusColor(driver.status) + "20" }}
                    >
                      <MaterialIcons
                        name={getStatusIcon(driver.status) as any}
                        size={18}
                        color={getStatusColor(driver.status)}
                      />
                      <Text
                        className="font-semibold ml-2"
                        style={{ color: getStatusColor(driver.status) }}
                      >
                        {getStatusLabel(driver.status)}
                      </Text>
                    </View>

                    {driver.status === "approved" && driver.reviewedAt && (
                      <Text className="text-muted text-xs mt-2">
                        Approved on {formatDate(driver.reviewedAt)}
                      </Text>
                    )}

                    {driver.status === "rejected" && driver.rejectionReason && (
                      <View className="mt-3 bg-red-600/10 rounded-xl p-3 w-full">
                        <Text className="text-red-400 text-xs font-medium">Rejection Reason:</Text>
                        <Text className="text-red-300 text-xs mt-1">{driver.rejectionReason}</Text>
                      </View>
                    )}

                    {driver.status === "pending_approval" && (
                      <Text className="text-muted text-xs mt-2 text-center">
                        Your application is being reviewed. You will be notified once a decision is made.
                      </Text>
                    )}
                  </View>
                </View>
              );

            case "personal":
              return (
                <View className="px-6 mb-4">
                  <Text className="text-lg font-semibold text-foreground mb-3">Personal Details</Text>
                  <View className="bg-surface rounded-xl p-4 border border-border">
                    <InfoRow icon="person" label="Full Name" value={driver.fullName} />
                    <InfoRow icon="phone" label="Phone" value={driver.phoneNumber} />
                    <InfoRow icon="badge" label="NRC Number" value={driver.nrcNumber} />
                    <InfoRow icon="schedule" label="Registered" value={formatDate(driver.registeredAt)} isLast />
                  </View>
                </View>
              );

            case "documents":
              return (
                <View className="px-6 mb-4">
                  <Text className="text-lg font-semibold text-foreground mb-3">Uploaded Documents</Text>
                  <View className="flex-row gap-3">
                    <DocCard
                      uri={driver.photos.driversLicense}
                      label="Driver's License"
                      icon="badge"
                      onPress={() => {
                        if (driver.photos.driversLicense) {
                          setSelectedImage(driver.photos.driversLicense);
                          setSelectedImageLabel("Driver's License");
                          setShowImageModal(true);
                        }
                      }}
                    />
                    <DocCard
                      uri={driver.photos.nrcId}
                      label="NRC / ID"
                      icon="credit-card"
                      onPress={() => {
                        if (driver.photos.nrcId) {
                          setSelectedImage(driver.photos.nrcId);
                          setSelectedImageLabel("NRC / ID");
                          setShowImageModal(true);
                        }
                      }}
                    />
                    <DocCard
                      uri={driver.photos.vehiclePhoto}
                      label="Vehicle"
                      icon="directions-car"
                      onPress={() => {
                        if (driver.photos.vehiclePhoto) {
                          setSelectedImage(driver.photos.vehiclePhoto);
                          setSelectedImageLabel("Vehicle Photo");
                          setShowImageModal(true);
                        }
                      }}
                    />
                  </View>
                </View>
              );

            case "primary-vehicle":
              return (
                <View className="px-6 mb-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-lg font-semibold text-foreground">Primary Vehicle</Text>
                    {driver.status === "approved" && (
                      <TouchableOpacity
                        onPress={() => {
                          setEditingVehicle({
                            vehicleType: driver.vehicleType,
                            numberPlate: driver.numberPlate,
                            vehicleColor: driver.vehicleColor,
                            vehicleModel: driver.vehicleModel,
                          });
                          setShowEditVehicleModal(true);
                        }}
                        className="flex-row items-center"
                      >
                        <MaterialIcons name="edit" size={16} color="#22C55E" />
                        <Text className="text-primary text-sm ml-1">Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View className="bg-surface rounded-xl p-4 border border-border">
                    <InfoRow icon="local-shipping" label="Type" value={driver.vehicleType} />
                    <InfoRow icon="confirmation-number" label="Plate" value={driver.numberPlate} />
                    <InfoRow icon="palette" label="Color" value={driver.vehicleColor} />
                    <InfoRow icon="directions-car" label="Model" value={driver.vehicleModel} />
                    <InfoRow
                      icon={driver.registrationValid ? "check-circle" : "cancel"}
                      label="Registration"
                      value={driver.registrationValid ? "Valid" : "Expired"}
                      valueColor={driver.registrationValid ? "#22C55E" : "#EF4444"}
                      isLast
                    />
                  </View>
                </View>
              );

            case "additional-vehicles":
              return (
                <View className="px-6 mb-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-lg font-semibold text-foreground">Additional Vehicles</Text>
                    {driver.status === "approved" && (
                      <TouchableOpacity
                        onPress={() => setShowAddVehicleModal(true)}
                        className="flex-row items-center bg-primary/20 rounded-lg px-3 py-1"
                      >
                        <MaterialIcons name="add" size={16} color="#22C55E" />
                        <Text className="text-primary text-sm ml-1">Add Vehicle</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {additionalVehicles.length === 0 ? (
                    <View className="bg-surface rounded-xl p-6 border border-border items-center">
                      <MaterialIcons name="directions-car" size={32} color="#9BA1A6" />
                      <Text className="text-muted text-sm mt-2">No additional vehicles added</Text>
                    </View>
                  ) : (
                    additionalVehicles.map((v) => (
                      <View key={v.id} className="bg-surface rounded-xl p-4 border border-border mb-2">
                        <View className="flex-row items-center justify-between mb-2">
                          <View className="flex-row items-center">
                            <MaterialIcons name="local-shipping" size={18} color="#22C55E" />
                            <Text className="text-foreground font-semibold ml-2">{v.vehicleType}</Text>
                          </View>
                          <TouchableOpacity onPress={() => handleRemoveVehicle(v.id)}>
                            <MaterialIcons name="delete" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                        <Text className="text-muted text-xs">{v.numberPlate} · {v.vehicleColor} · {v.vehicleModel}</Text>
                        <Text className="text-muted/60 text-xs mt-1">Added {formatDate(v.addedAt)}</Text>
                      </View>
                    ))
                  )}
                </View>
              );

            case "rating":
              return (
                <View className="px-6 mb-4">
                  <Text className="text-lg font-semibold text-foreground mb-3">Driver Rating</Text>
                  <View className="bg-surface rounded-xl p-6 border border-border items-center">
                    <View className="flex-row items-center mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <MaterialIcons
                          key={star}
                          name="star"
                          size={28}
                          color={star <= 0 ? "#9BA1A6" : "#9BA1A6"}
                        />
                      ))}
                    </View>
                    <Text className="text-foreground font-bold text-2xl">--</Text>
                    <Text className="text-muted text-sm mt-1">No ratings yet</Text>
                    <Text className="text-muted/60 text-xs mt-2 text-center">
                      Your rating will appear here once customers rate your deliveries.
                    </Text>
                  </View>
                </View>
              );

            default:
              return null;
          }
        }}
      />

      {/* Edit Vehicle Modal */}
      <Modal visible={showEditVehicleModal} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-surface rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground font-bold text-lg">Update Vehicle</Text>
              <TouchableOpacity onPress={() => setShowEditVehicleModal(false)}>
                <MaterialIcons name="close" size={24} color="#ECEDEE" />
              </TouchableOpacity>
            </View>

            <VehicleForm
              data={editingVehicle}
              onChange={setEditingVehicle}
              showDropdown={showEditDropdown}
              setShowDropdown={setShowEditDropdown}
              vehicleTypes={VEHICLE_TYPES}
            />

            <TouchableOpacity
              onPress={handleUpdateVehicle}
              className="bg-primary rounded-xl py-4 items-center mt-4"
            >
              <Text className="text-white font-semibold">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Vehicle Modal */}
      <Modal visible={showAddVehicleModal} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-surface rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground font-bold text-lg">Add Vehicle</Text>
              <TouchableOpacity onPress={() => setShowAddVehicleModal(false)}>
                <MaterialIcons name="close" size={24} color="#ECEDEE" />
              </TouchableOpacity>
            </View>

            <VehicleForm
              data={newVehicle}
              onChange={setNewVehicle}
              showDropdown={showVehicleDropdown}
              setShowDropdown={setShowVehicleDropdown}
              vehicleTypes={VEHICLE_TYPES}
            />

            <TouchableOpacity
              onPress={handleAddVehicle}
              className="bg-primary rounded-xl py-4 items-center mt-4"
            >
              <Text className="text-white font-semibold">Add Vehicle</Text>
            </TouchableOpacity>
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

      {/* Logout Button */}
      <View className="px-6 pb-24 pt-4 border-t border-border">
        <TouchableOpacity
          onPress={() => {
            Alert.alert("Logout", "Are you sure you want to logout?", [
              { text: "Cancel", onPress: () => {}, style: "cancel" },
              {
                text: "Logout",
                onPress: async () => {
                  try {
                    await logout();
                    router.replace("/" as any);
                  } catch (error) {
                    Alert.alert("Error", "Failed to logout");
                  }
                },
                style: "destructive",
              },
            ]);
          }}
          className="bg-error/20 rounded-xl py-4 flex-row items-center justify-center gap-2"
        >
          <MaterialIcons name="logout" size={20} color="#EF4444" />
          <Text className="text-error font-semibold text-base">Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Navigation */}
      <CarrierBottomNav currentTab="profile" />
    </ScreenContainer>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
  isLast,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
  isLast?: boolean;
}) {
  return (
    <View className={`flex-row items-center py-3 ${isLast ? "" : "border-b border-border/30"}`}>
      <MaterialIcons name={icon as any} size={18} color="#9BA1A6" />
      <Text className="text-muted text-sm ml-3 flex-1">{label}</Text>
      <Text className="text-foreground font-medium text-sm" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </Text>
    </View>
  );
}

function DocCard({
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
    <TouchableOpacity onPress={onPress} className="flex-1 items-center" disabled={!uri}>
      <View className="w-full aspect-square rounded-xl overflow-hidden bg-surface border border-border items-center justify-center">
        {uri ? (
          <Image source={{ uri }} style={styles.thumbnail} contentFit="cover" />
        ) : (
          <View className="items-center">
            <MaterialIcons name={icon as any} size={24} color="#9BA1A6" />
            <Text className="text-muted text-xs mt-1">No file</Text>
          </View>
        )}
      </View>
      <Text className="text-muted text-xs mt-1 text-center">{label}</Text>
    </TouchableOpacity>
  );
}

function VehicleForm({
  data,
  onChange,
  showDropdown,
  setShowDropdown,
  vehicleTypes,
}: {
  data: { vehicleType: string; numberPlate: string; vehicleColor: string; vehicleModel: string };
  onChange: (data: any) => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  vehicleTypes: string[];
}) {
  return (
    <View>
      <Text className="text-sm font-medium text-foreground mb-2">Vehicle Type</Text>
      <TouchableOpacity
        onPress={() => setShowDropdown(!showDropdown)}
        className="bg-background border border-border rounded-lg px-4 py-3 flex-row items-center justify-between mb-3"
      >
        <Text className="text-foreground">{data.vehicleType}</Text>
        <MaterialIcons name={showDropdown ? "expand-less" : "expand-more"} size={24} color="#ECEDEE" />
      </TouchableOpacity>
      {showDropdown && (
        <View className="bg-background border border-border rounded-lg mb-3">
          {vehicleTypes.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => {
                onChange({ ...data, vehicleType: type });
                setShowDropdown(false);
              }}
              className="px-4 py-3 border-b border-border/30"
            >
              <Text className="text-foreground">{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text className="text-sm font-medium text-foreground mb-2">Number Plate</Text>
      <TextInput
        value={data.numberPlate}
        onChangeText={(t) => onChange({ ...data, numberPlate: t.toUpperCase() })}
        placeholder="e.g., ZMB 1234"
        placeholderTextColor="#9BA1A6"
        className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
        style={styles.input}
      />

      <Text className="text-sm font-medium text-foreground mb-2">Vehicle Color</Text>
      <TextInput
        value={data.vehicleColor}
        onChangeText={(t) => onChange({ ...data, vehicleColor: t })}
        placeholder="e.g., White, Black"
        placeholderTextColor="#9BA1A6"
        className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
        style={styles.input}
      />

      <Text className="text-sm font-medium text-foreground mb-2">Vehicle Model</Text>
      <TextInput
        value={data.vehicleModel}
        onChangeText={(t) => onChange({ ...data, vehicleModel: t })}
        placeholder="e.g., Toyota Hilux"
        placeholderTextColor="#9BA1A6"
        className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
        style={styles.input}
      />
    </View>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  input: {
    color: "#ECEDEE",
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
