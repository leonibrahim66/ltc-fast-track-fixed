import { Modal, ScrollView, Text, View, TouchableOpacity, Image } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";

interface ProfilePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  formData: {
    fullName: string;
    homeLocation: string;
    nrcNumber: string;
    vehicleType: string;
    customVehicleType: string;
    numberPlate: string;
    vehicleColor: string;
    vehicleModel: string;
    registrationValid: boolean;
  };
  photos: {
    driversLicense: string | null;
    nrcFrontImage: string | null;
    nrcBackImage: string | null;
    vehiclePhoto: string | null;
  };
  onEdit: () => void;
}

export function ProfilePreviewModal({
  visible,
  onClose,
  formData,
  photos,
  onEdit,
}: ProfilePreviewModalProps) {
  const colors = useColors();

  const displayVehicleType =
    formData.vehicleType === "Other – Enter Manually"
      ? formData.customVehicleType || "Not specified"
      : formData.vehicleType;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-6 py-4 border-b"
          style={{ borderBottomColor: colors.border }}
        >
          <Text className="text-2xl font-bold text-foreground">Profile Preview</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-6 py-6">
          {/* Personal Details Section */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Personal Details</Text>
            <View className="bg-surface rounded-2xl p-4 space-y-3">
              <View>
                <Text className="text-xs text-muted mb-1">Full Name</Text>
                <Text className="text-base text-foreground font-medium">{formData.fullName || "Not provided"}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">Home Location</Text>
                <Text className="text-base text-foreground font-medium">{formData.homeLocation || "Not provided"}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">NRC Number</Text>
                <Text className="text-base text-foreground font-medium">{formData.nrcNumber || "Not provided"}</Text>
              </View>
            </View>
          </View>

          {/* Vehicle Details Section */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Vehicle Details</Text>
            <View className="bg-surface rounded-2xl p-4 space-y-3">
              <View>
                <Text className="text-xs text-muted mb-1">Vehicle Type</Text>
                <Text className="text-base text-foreground font-medium">{displayVehicleType}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">Number Plate</Text>
                <Text className="text-base text-foreground font-medium">{formData.numberPlate || "Not provided"}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">Vehicle Color</Text>
                <Text className="text-base text-foreground font-medium">{formData.vehicleColor || "Not provided"}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">Vehicle Model</Text>
                <Text className="text-base text-foreground font-medium">{formData.vehicleModel || "Not provided"}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">Registration Valid</Text>
                <Text className="text-base text-foreground font-medium">
                  {formData.registrationValid ? "✓ Yes" : "✗ No"}
                </Text>
              </View>
            </View>
          </View>

          {/* Documents Section */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Uploaded Documents</Text>
            <View className="bg-surface rounded-2xl p-4 space-y-4">
              <View>
                <Text className="text-xs text-muted mb-2">Driver's License</Text>
                {photos.driversLicense ? (
                  <Image
                    source={{ uri: photos.driversLicense }}
                    className="w-full h-40 rounded-lg"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-40 bg-background rounded-lg items-center justify-center">
                    <MaterialIcons name="image" size={48} color={colors.muted} />
                    <Text className="text-muted text-sm mt-2">No image uploaded</Text>
                  </View>
                )}
              </View>

              <View>
                <Text className="text-xs text-muted mb-2">NRC Front</Text>
                {photos.nrcFrontImage ? (
                  <Image
                    source={{ uri: photos.nrcFrontImage }}
                    className="w-full h-40 rounded-lg"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-40 bg-background rounded-lg items-center justify-center">
                    <MaterialIcons name="image" size={48} color={colors.muted} />
                    <Text className="text-muted text-sm mt-2">No image uploaded</Text>
                  </View>
                )}
              </View>

              <View>
                <Text className="text-xs text-muted mb-2">NRC Back</Text>
                {photos.nrcBackImage ? (
                  <Image
                    source={{ uri: photos.nrcBackImage }}
                    className="w-full h-40 rounded-lg"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-40 bg-background rounded-lg items-center justify-center">
                    <MaterialIcons name="image" size={48} color={colors.muted} />
                    <Text className="text-muted text-sm mt-2">No image uploaded</Text>
                  </View>
                )}
              </View>

              <View>
                <Text className="text-xs text-muted mb-2">Vehicle Photo</Text>
                {photos.vehiclePhoto ? (
                  <Image
                    source={{ uri: photos.vehiclePhoto }}
                    className="w-full h-40 rounded-lg"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-40 bg-background rounded-lg items-center justify-center">
                    <MaterialIcons name="image" size={48} color={colors.muted} />
                    <Text className="text-muted text-sm mt-2">No image uploaded</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View className="px-6 py-4 border-t" style={{ borderTopColor: colors.border }}>
          <TouchableOpacity
            onPress={onEdit}
            className="bg-primary rounded-xl py-3 items-center mb-3"
          >
            <Text className="text-white font-semibold text-base">Edit Information</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            className="bg-surface rounded-xl py-3 items-center"
          >
            <Text className="text-foreground font-semibold text-base">Close Preview</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
