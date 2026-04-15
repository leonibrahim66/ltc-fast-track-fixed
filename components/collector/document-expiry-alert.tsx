import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface DocumentExpiryAlertProps {
  documents: Array<{
    type: string;
    name: string;
    status: "valid" | "expiring" | "expired" | "missing";
    daysUntilExpiry: number;
  }>;
}

/**
 * Document Expiry Alert Component
 * Displays warnings for documents that are expiring soon or expired
 * 
 * Features:
 * - Shows alert badge with count of expiring/expired documents
 * - Color-coded by severity (yellow for expiring, red for expired)
 * - Tappable to navigate to documents screen
 * - Dismissible for valid documents
 */
export function DocumentExpiryAlert({ documents }: DocumentExpiryAlertProps) {
  const router = useRouter();
  const colors = useColors();

  // Filter documents that need attention
  const alerts = documents.filter(
    (doc) => doc.status === "expiring" || doc.status === "expired" || doc.status === "missing"
  );

  if (alerts.length === 0) {
    return null; // No alerts to show
  }

  // Determine alert severity
  const hasExpired = alerts.some((doc) => doc.status === "expired");
  const hasMissing = alerts.some((doc) => doc.status === "missing");
  const severity = hasExpired || hasMissing ? "critical" : "warning";

  const alertColor = severity === "critical" ? "#EF4444" : "#F59E0B";
  const alertBgColor = severity === "critical" ? "#FEE2E2" : "#FEF3C7";
  const alertIcon = severity === "critical" ? "error" : "warning";

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: alertBgColor, borderColor: alertColor }]}
      onPress={() => router.push("/collector-documents")}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <MaterialIcons name={alertIcon} size={24} color={alertColor} />
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.title, { color: alertColor }]}>
          {severity === "critical" ? "Document Action Required" : "Document Expiring Soon"}
        </Text>
        <Text style={[styles.message, { color: "#6B7280" }]}>
          {alerts.length === 1
            ? `${alerts[0].name} ${
                alerts[0].status === "expired"
                  ? "has expired"
                  : alerts[0].status === "missing"
                  ? "is missing"
                  : `expires in ${alerts[0].daysUntilExpiry} days`
              }`
            : `${alerts.length} documents need attention`}
        </Text>
      </View>

      <MaterialIcons name="chevron-right" size={24} color={alertColor} />
    </TouchableOpacity>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
    marginHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: _rs.sp(12),
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    marginBottom: _rs.sp(4),
  },
  message: {
    fontSize: _rs.fs(14),
  },
});
