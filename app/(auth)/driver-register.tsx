import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

type VehicleType = "motorbike" | "van" | "pickup" | "truck" | "trailer";

interface DocumentUpload {
  uri: string;
  name: string;
  type: string;
}

const VEHICLE_TYPES: { value: VehicleType; label: string; icon: string }[] = [
  { value: "motorbike", label: "Motorbike", icon: "two-wheeler" },
  { value: "van", label: "Van", icon: "airport-shuttle" },
  { value: "pickup", label: "Pickup", icon: "local-shipping" },
  { value: "truck", label: "Truck", icon: "local-shipping" },
  { value: "trailer", label: "Trailer", icon: "rv-hookup" },
];

export default function DriverRegisterScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [plateNumber, setPlateNumber] = useState("");

  // Document uploads
  const [driversLicense, setDriversLicense] = useState<DocumentUpload | null>(null);
  const [idDocument, setIdDocument] = useState<DocumentUpload | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<DocumentUpload | null>(null);

  const registerMutation = trpc.drivers.register.useMutation();

  const pickImage = async (setDocument: (doc: DocumentUpload) => void, documentType: string) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow access to your photo library to upload documents.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setDocument({
          uri: asset.uri,
          name: `${documentType}_${Date.now()}.jpg`,
          type: "image/jpeg",
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const takePhoto = async (setDocument: (doc: DocumentUpload) => void, documentType: string) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow access to your camera to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setDocument({
          uri: asset.uri,
          name: `${documentType}_${Date.now()}.jpg`,
          type: "image/jpeg",
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const validateStep1 = () => {
    if (!fullName.trim()) {
      Alert.alert("Required", "Please enter your full name");
      return false;
    }
    if (!phone.trim() || phone.length < 10) {
      Alert.alert("Required", "Please enter a valid phone number");
      return false;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Required", "Please enter a valid email address");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!vehicleType) {
      Alert.alert("Required", "Please select your vehicle type");
      return false;
    }
    if (!plateNumber.trim()) {
      Alert.alert("Required", "Please enter your vehicle plate number");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!driversLicense) {
      Alert.alert("Required", "Please upload your driver's license");
      return false;
    }
    if (!idDocument) {
      Alert.alert("Required", "Please upload your NRC/ID or passport");
      return false;
    }
    if (!vehiclePhoto) {
      Alert.alert("Required", "Please upload a photo of your vehicle");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setIsSubmitting(true);
    try {
      await registerMutation.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        vehicleType: vehicleType!,
        plateNumber: plateNumber.trim().toUpperCase(),
        driversLicenseUrl: driversLicense!.uri,
        idDocumentUrl: idDocument!.uri,
        vehiclePhotoUrl: vehiclePhoto!.uri,
      });

      Alert.alert(
        "Registration Submitted!",
        "Your application has been submitted for review. You will be notified once your account is approved.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/welcome" as any) }]
      );
    } catch (error: any) {
      Alert.alert("Registration Failed", error.message || "Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDocumentUpload = (
    label: string,
    document: DocumentUpload | null,
    setDocument: (doc: DocumentUpload) => void,
    documentType: string
  ) => (
    <View className="mb-4">
      <Text className="text-foreground font-medium mb-2">{label}</Text>
      {document ? (
        <View className="bg-surface rounded-xl p-4 flex-row items-center">
          <MaterialIcons name="check-circle" size={24} color="#22C55E" />
          <Text className="text-foreground ml-3 flex-1" numberOfLines={1}>
            {document.name}
          </Text>
          <TouchableOpacity
            onPress={() => setDocument(null as any)}
            style={{ padding: 8 }}
          >
            <MaterialIcons name="close" size={20} color="#F87171" />
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-surface rounded-xl p-4 items-center"
            onPress={() => pickImage(setDocument, documentType)}
            style={{ opacity: 1 }}
          >
            <MaterialIcons name="photo-library" size={28} color="#22C55E" />
            <Text className="text-muted text-sm mt-2">Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-surface rounded-xl p-4 items-center"
            onPress={() => takePhoto(setDocument, documentType)}
            style={{ opacity: 1 }}
          >
            <MaterialIcons name="camera-alt" size={28} color="#22C55E" />
            <Text className="text-muted text-sm mt-2">Camera</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-4 flex-row items-center">
          <TouchableOpacity onPress={handleBack} style={{ padding: 8 }}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground ml-4">
            Driver Registration
          </Text>
        </View>

        {/* Progress Indicator */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between">
            {[1, 2, 3].map((s) => (
              <View key={s} className="flex-row items-center flex-1">
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    s <= step ? "bg-primary" : "bg-surface"
                  }`}
                >
                  <Text
                    className={`font-bold ${
                      s <= step ? "text-white" : "text-muted"
                    }`}
                  >
                    {s}
                  </Text>
                </View>
                {s < 3 && (
                  <View
                    className={`flex-1 h-1 mx-2 ${
                      s < step ? "bg-primary" : "bg-surface"
                    }`}
                  />
                )}
              </View>
            ))}
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-muted text-xs">Personal</Text>
            <Text className="text-muted text-xs">Vehicle</Text>
            <Text className="text-muted text-xs">Documents</Text>
          </View>
        </View>

        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <View>
              <Text className="text-lg font-semibold text-foreground mb-4">
                Personal Information
              </Text>

              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Full Name *</Text>
                <TextInput
                  className="bg-surface text-foreground rounded-xl px-4 py-3"
                  placeholder="Enter your full name"
                  placeholderTextColor="#9BA1A6"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>

              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Phone Number *</Text>
                <TextInput
                  className="bg-surface text-foreground rounded-xl px-4 py-3"
                  placeholder="+260 9XX XXX XXX"
                  placeholderTextColor="#9BA1A6"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Email Address *</Text>
                <TextInput
                  className="bg-surface text-foreground rounded-xl px-4 py-3"
                  placeholder="your@email.com"
                  placeholderTextColor="#9BA1A6"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
          )}

          {/* Step 2: Vehicle Information */}
          {step === 2 && (
            <View>
              <Text className="text-lg font-semibold text-foreground mb-4">
                Vehicle Information
              </Text>

              <Text className="text-foreground font-medium mb-3">Vehicle Type *</Text>
              <View className="flex-row flex-wrap gap-3 mb-6">
                {VEHICLE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    className={`flex-1 min-w-[100px] p-4 rounded-xl items-center ${
                      vehicleType === type.value ? "bg-primary" : "bg-surface"
                    }`}
                    onPress={() => setVehicleType(type.value)}
                    style={{ opacity: 1 }}
                  >
                    <MaterialIcons
                      name={type.icon as any}
                      size={32}
                      color={vehicleType === type.value ? "#FFFFFF" : "#22C55E"}
                    />
                    <Text
                      className={`mt-2 text-sm font-medium ${
                        vehicleType === type.value ? "text-white" : "text-foreground"
                      }`}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">
                  Vehicle Plate Number *
                </Text>
                <TextInput
                  className="bg-surface text-foreground rounded-xl px-4 py-3"
                  placeholder="ABC 1234 ZM"
                  placeholderTextColor="#9BA1A6"
                  value={plateNumber}
                  onChangeText={setPlateNumber}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          )}

          {/* Step 3: Document Uploads */}
          {step === 3 && (
            <View>
              <Text className="text-lg font-semibold text-foreground mb-2">
                Upload Documents
              </Text>
              <Text className="text-muted mb-6">
                Please upload clear photos of the following documents for verification.
              </Text>

              {renderDocumentUpload(
                "Driver's License *",
                driversLicense,
                setDriversLicense,
                "drivers_license"
              )}

              {renderDocumentUpload(
                "NRC/ID or Passport *",
                idDocument,
                setIdDocument,
                "id_document"
              )}

              {renderDocumentUpload(
                "Vehicle Photo *",
                vehiclePhoto,
                setVehiclePhoto,
                "vehicle_photo"
              )}

              <View className="bg-surface rounded-xl p-4 mt-4 mb-6">
                <View className="flex-row items-start">
                  <MaterialIcons name="info" size={20} color="#FBBF24" />
                  <Text className="text-muted text-sm ml-3 flex-1">
                    Your documents will be reviewed by our team. This usually takes 1-2 business days.
                    You'll receive a notification once your account is approved.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Spacer for bottom button */}
          <View className="h-24" />
        </ScrollView>

        {/* Bottom Action Button */}
        <View className="px-6 pb-6 pt-4 bg-background">
          {step < 3 ? (
            <TouchableOpacity
              className="bg-primary rounded-xl py-4 items-center"
              onPress={handleNext}
              style={{ opacity: 1 }}
            >
              <Text className="text-white font-semibold text-lg">Continue</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className={`rounded-xl py-4 items-center ${
                isSubmitting ? "bg-surface" : "bg-primary"
              }`}
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={{ opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white font-semibold text-lg">
                  Submit Application
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
