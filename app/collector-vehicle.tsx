import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function CollectorVehicleDetailsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();

  const vehicleDetails: any = user?.vehicleDetails || {};
  const vehicleRegistration = user?.vehicleRegistration || "N/A";
  const transportCategory = user?.transportCategory || "N/A";

  const vehicleInfo = [
    {
      label: "Vehicle Type",
      value: transportCategory,
      icon: "local-shipping",
    },
    {
      label: "Number Plate",
      value: vehicleDetails.plateNumber || vehicleRegistration,
      icon: "confirmation-number",
    },
    {
      label: "Make",
      value: vehicleDetails.make || "N/A",
      icon: "build",
    },
    {
      label: "Model",
      value: vehicleDetails.model || "N/A",
      icon: "directions-car",
    },
    {
      label: "Year",
      value: vehicleDetails.year || "N/A",
      icon: "calendar-today",
    },
    {
      label: "Color",
      value: vehicleDetails.color || "N/A",
      icon: "palette",
    },
    {
      label: "Capacity",
      value: (vehicleDetails as any).capacity || "N/A",
      icon: "scale",
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vehicle Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          {/* Vehicle Card */}
          <View
            style={[
              styles.vehicleCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.vehicleHeader}>
              <View style={[styles.vehicleIconContainer, { backgroundColor: colors.primary + "20" }]}>
                <MaterialIcons name="local-shipping" size={32} color={colors.primary} />
              </View>
              <View style={styles.vehicleHeaderText}>
                <Text style={[styles.vehicleTitle, { color: colors.text }]}>
                  {vehicleDetails.make || "Vehicle"} {vehicleDetails.model || ""}
                </Text>
                <Text style={[styles.vehicleSubtitle, { color: colors.muted }]}>
                  {vehicleDetails.plateNumber || vehicleRegistration}
                </Text>
              </View>
            </View>

            {/* Registration Status */}
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: "#10B981" + "20" }]}>
                <MaterialIcons name="check-circle" size={16} color="#10B981" />
                <Text style={styles.statusText}>Registration Valid</Text>
              </View>
            </View>
          </View>

          {/* Vehicle Information */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Vehicle Information
            </Text>
            {vehicleInfo.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.infoRow,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.infoLeft}>
                  <View style={[styles.infoIconContainer, { backgroundColor: colors.primary + "10" }]}>
                    <MaterialIcons name={item.icon as any} size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>
                    {item.label}
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Edit Button */}
          <TouchableOpacity
            onPress={() => router.push("/collector-profile-edit" as any)}
            style={[styles.editButton, { backgroundColor: colors.primary }]}
          >
            <MaterialIcons name="edit" size={20} color="#fff" />
            <Text style={styles.editButtonText}>Edit Vehicle Details</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  vehicleCard: {
    borderRadius: _rs.s(16),
    padding: _rs.sp(20),
    marginBottom: _rs.sp(24),
    borderWidth: 1,
  },
  vehicleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: _rs.sp(16),
  },
  vehicleIconContainer: {
    width: _rs.s(64),
    height: _rs.s(64),
    borderRadius: _rs.s(32),
    alignItems: "center",
    justifyContent: "center",
    marginRight: _rs.sp(16),
  },
  vehicleHeaderText: {
    flex: 1,
  },
  vehicleTitle: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
    marginBottom: _rs.sp(4),
  },
  vehicleSubtitle: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
  },
  statusContainer: {
    flexDirection: "row",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(6),
    borderRadius: _rs.s(20),
  },
  statusText: {
    fontSize: _rs.fs(12),
    fontWeight: "600",
    color: "#10B981",
    marginLeft: _rs.sp(4),
  },
  section: {
    marginBottom: _rs.sp(24),
  },
  sectionTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    marginBottom: _rs.sp(12),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    marginBottom: _rs.sp(8),
    borderWidth: 1,
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  infoIconContainer: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    alignItems: "center",
    justifyContent: "center",
    marginRight: _rs.sp(12),
  },
  infoLabel: {
    fontSize: _rs.fs(14),
    fontWeight: "500",
  },
  infoValue: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    marginTop: _rs.sp(8),
  },
  editButtonText: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    color: "#fff",
    marginLeft: _rs.sp(8),
  },
});
