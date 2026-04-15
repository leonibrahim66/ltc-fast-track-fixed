import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function CollectorDocumentsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // In a real app, these would be stored in user profile during registration
  // For now, we'll show placeholder or use mock data
  const documents = [
    {
      id: "license",
      title: "Driver's License",
      description: "Valid driver's license photo",
      icon: "credit-card",
      image: (user as any)?.driverLicense || null,
      status: (user as any)?.driverLicense ? "uploaded" : "missing",
    },
    {
      id: "nrc-front",
      title: "NRC Front",
      description: "National Registration Card (Front)",
      icon: "badge",
      image: (user as any)?.nrcFront || null,
      status: (user as any)?.nrcFront ? "uploaded" : "missing",
    },
    {
      id: "nrc-back",
      title: "NRC Back",
      description: "National Registration Card (Back)",
      icon: "badge",
      image: (user as any)?.nrcBack || null,
      status: (user as any)?.nrcBack ? "uploaded" : "missing",
    },
    {
      id: "vehicle",
      title: "Vehicle Photo",
      description: "Photo of registered vehicle",
      icon: "local-shipping",
      image: (user as any)?.vehiclePhoto || null,
      status: (user as any)?.vehiclePhoto ? "uploaded" : "missing",
    },
  ];

  const handleViewDocument = (image: string | null) => {
    if (image) {
      setSelectedImage(image);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Documents</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: "#EFF6FF", borderColor: "#3B82F6" }]}>
            <MaterialIcons name="info" size={20} color="#3B82F6" />
            <Text style={styles.infoBannerText}>
              Keep your documents up to date for verification purposes
            </Text>
          </View>

          {/* Documents List */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Uploaded Documents
            </Text>
            {documents.map((doc) => (
              <View
                key={doc.id}
                style={[
                  styles.documentCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.documentLeft}>
                  <View
                    style={[
                      styles.documentIconContainer,
                      {
                        backgroundColor:
                          doc.status === "uploaded"
                            ? "#10B981" + "20"
                            : "#EF4444" + "20",
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={doc.icon as any}
                      size={24}
                      color={doc.status === "uploaded" ? "#10B981" : "#EF4444"}
                    />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={[styles.documentTitle, { color: colors.text }]}>
                      {doc.title}
                    </Text>
                    <Text style={[styles.documentDescription, { color: colors.muted }]}>
                      {doc.description}
                    </Text>
                    <View style={styles.statusContainer}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              doc.status === "uploaded"
                                ? "#10B981" + "20"
                                : "#EF4444" + "20",
                          },
                        ]}
                      >
                        <MaterialIcons
                          name={doc.status === "uploaded" ? "check-circle" : "warning"}
                          size={14}
                          color={doc.status === "uploaded" ? "#10B981" : "#EF4444"}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color: doc.status === "uploaded" ? "#10B981" : "#EF4444",
                            },
                          ]}
                        >
                          {doc.status === "uploaded" ? "Uploaded" : "Missing"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                {doc.image && (
                  <TouchableOpacity
                    onPress={() => handleViewDocument(doc.image)}
                    style={[styles.viewButton, { backgroundColor: colors.primary }]}
                  >
                    <MaterialIcons name="visibility" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* Upload New Documents */}
          <TouchableOpacity
            onPress={() => router.push("/collector-profile-edit" as any)}
            style={[styles.uploadButton, { backgroundColor: colors.primary }]}
          >
            <MaterialIcons name="cloud-upload" size={20} color="#fff" />
            <Text style={styles.uploadButtonText}>Update Documents</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Image Viewer Modal */}
      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedImage(null)}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSelectedImage(null)}
              >
                <MaterialIcons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              {selectedImage && (
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(16),
  },
  backButton: {
    padding: _rs.sp(4),
  },
  headerTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "600",
    color: "#fff",
  },
  content: {
    padding: _rs.sp(16),
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(12),
    borderRadius: _rs.s(12),
    marginBottom: _rs.sp(24),
    borderWidth: 1,
  },
  infoBannerText: {
    flex: 1,
    fontSize: _rs.fs(14),
    color: "#3B82F6",
    marginLeft: _rs.sp(8),
  },
  section: {
    marginBottom: _rs.sp(24),
  },
  sectionTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    marginBottom: _rs.sp(12),
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    marginBottom: _rs.sp(12),
    borderWidth: 1,
  },
  documentLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  documentIconContainer: {
    width: _rs.s(48),
    height: _rs.s(48),
    borderRadius: _rs.s(24),
    alignItems: "center",
    justifyContent: "center",
    marginRight: _rs.sp(12),
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    marginBottom: _rs.sp(4),
  },
  documentDescription: {
    fontSize: _rs.fs(12),
    marginBottom: _rs.sp(6),
  },
  statusContainer: {
    flexDirection: "row",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(8),
    paddingVertical: _rs.sp(4),
    borderRadius: _rs.s(12),
  },
  statusText: {
    fontSize: _rs.fs(11),
    fontWeight: "600",
    marginLeft: _rs.sp(4),
  },
  viewButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    alignItems: "center",
    justifyContent: "center",
    marginLeft: _rs.sp(12),
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    marginTop: _rs.sp(8),
  },
  uploadButtonText: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    color: "#fff",
    marginLeft: _rs.sp(8),
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: _rs.s(44),
    height: _rs.s(44),
    borderRadius: _rs.s(22),
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.8,
  },
});
