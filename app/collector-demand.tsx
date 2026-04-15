import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface MaterialRequest {
  id: string;
  materialType: string;
  quantity: string;
  location: string;
  deadline: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  assignedCollectorId?: string;
  customerName?: string;
  customerPhone?: string;
  description?: string;
  createdAt: string;
}

export default function CollectorDemandScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignedRequests();
  }, []);

  const loadAssignedRequests = async () => {
    setLoading(true);
    try {
      // TODO: Replace with backend API call
      // GET /api/collector/assigned-requests?collector_id={collector_id}
      // Filter: demand.assigned_collector_id == current_collector_id
      // Returns: { requests: MaterialRequest[] }
      
      // Backend integration required:
      // - Query material_requests table
      // - Filter by assigned_collector_id
      // - Return only requests assigned to this collector
      
      setRequests([]);
    } catch (e) {
      console.error("Error loading assigned requests:", e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAssignedRequests();
    setRefreshing(false);
  };

  const handleAcceptTask = async (requestId: string) => {
    Alert.alert(
      "Accept Task",
      "Are you sure you want to accept this material collection task?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              // TODO: Trigger backend update endpoint
              // PATCH /api/collector/accept-request
              // Body: { request_id, collector_id }
              // Updates: status = "in_progress"
              
              // Backend integration required:
              // - Update material_requests table
              // - Set status to "in_progress"
              // - Set accepted_at timestamp
              // - Send notification to customer
              
              Alert.alert(
                "Backend Integration Required",
                "PATCH /api/collector/accept-request\n\n" +
                "Updates:\n" +
                "• status = 'in_progress'\n" +
                "• accepted_at = current_timestamp\n" +
                "• Notify customer",
                [{ text: "OK" }]
              );
              
              // Refresh list after accepting
              await loadAssignedRequests();
            } catch (e) {
              console.error("Error accepting task:", e);
              Alert.alert("Error", "Failed to accept task. Please try again.");
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "in_progress":
        return "#3B82F6";
      case "completed":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      default:
        return "#9BA1A6";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "schedule";
      case "in_progress":
        return "local-shipping";
      case "completed":
        return "check-circle";
      case "cancelled":
        return "cancel";
      default:
        return "help";
    }
  };

  const getMaterialIcon = (materialType: string) => {
    const type = materialType.toLowerCase();
    if (type.includes("plastic")) return "recycling";
    if (type.includes("metal")) return "construction";
    if (type.includes("paper")) return "description";
    if (type.includes("glass")) return "local-drink";
    if (type.includes("electronic")) return "devices";
    return "delete";
  };

  const renderRequest = ({ item }: { item: MaterialRequest }) => {
    const isOverdue = new Date(item.deadline) < new Date() && item.status !== "completed";
    
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isOverdue && { borderColor: "#EF4444", borderWidth: 2 },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.materialInfo}>
            <View
              style={[
                styles.materialIcon,
                { backgroundColor: `${colors.primary}15` },
              ]}
            >
              <MaterialIcons
                name={getMaterialIcon(item.materialType) as any}
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.materialDetails}>
              <Text style={[styles.materialType, { color: colors.foreground }]}>
                {item.materialType}
              </Text>
              <Text style={[styles.quantity, { color: colors.muted }]}>
                Quantity: {item.quantity}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(item.status)}15` },
            ]}
          >
            <MaterialIcons
              name={getStatusIcon(item.status) as any}
              size={14}
              color={getStatusColor(item.status)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.status) },
              ]}
            >
              {item.status.replace("_", " ").toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <MaterialIcons name="location-on" size={18} color={colors.muted} />
            <Text style={[styles.infoText, { color: colors.foreground }]} numberOfLines={2}>
              {item.location}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <MaterialIcons name="event" size={18} color={isOverdue ? "#EF4444" : colors.muted} />
            <Text
              style={[
                styles.infoText,
                { color: isOverdue ? "#EF4444" : colors.muted },
              ]}
            >
              Deadline: {new Date(item.deadline).toLocaleDateString()}
              {isOverdue && " (OVERDUE)"}
            </Text>
          </View>

          {item.customerName && (
            <View style={styles.infoRow}>
              <MaterialIcons name="person" size={18} color={colors.muted} />
              <Text style={[styles.infoText, { color: colors.muted }]}>
                {item.customerName}
              </Text>
            </View>
          )}

          {item.description && (
            <View style={styles.descriptionSection}>
              <Text style={[styles.descriptionLabel, { color: colors.muted }]}>
                Description:
              </Text>
              <Text style={[styles.descriptionText, { color: colors.foreground }]}>
                {item.description}
              </Text>
            </View>
          )}
        </View>

        {item.status === "pending" && (
          <TouchableOpacity
            onPress={() => handleAcceptTask(item.id)}
            style={[styles.acceptButton, { backgroundColor: colors.primary }]}
          >
            <MaterialIcons name="check" size={20} color="#FFFFFF" />
            <Text style={styles.acceptButtonText}>Accept Task</Text>
          </TouchableOpacity>
        )}

        {item.status === "in_progress" && (
          <TouchableOpacity
            onPress={() => router.push(`/demand-details/${item.id}` as any)}
            style={[
              styles.viewButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MaterialIcons name="visibility" size={20} color={colors.foreground} />
            <Text style={[styles.viewButtonText, { color: colors.foreground }]}>
              View Details
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assigned Material Requests</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Info Card */}
      <View style={styles.infoSection}>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <MaterialIcons name="info" size={20} color={colors.primary} />
          <Text style={[styles.infoCardText, { color: colors.muted }]}>
            These are material collection requests assigned to you by the admin. Accept tasks to
            start collection.
          </Text>
        </View>
      </View>

      {/* Requests List */}
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="assignment" size={64} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {loading
                ? "Loading assigned requests..."
                : "No material requests assigned to you"}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.muted }]}>
              Backend will filter requests by assigned_collector_id
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: _rs.sp(20),
    paddingTop: _rs.sp(16),
    borderBottomLeftRadius: _rs.s(24),
    borderBottomRightRadius: _rs.s(24),
    marginBottom: _rs.sp(16),
  },
  backButton: {
    padding: _rs.sp(4),
  },
  headerTitle: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  infoSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(16),
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    gap: _rs.sp(12),
  },
  infoCardText: {
    flex: 1,
    fontSize: _rs.fs(13),
    lineHeight: _rs.fs(18),
  },
  card: {
    marginHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(16),
    padding: _rs.sp(16),
    borderRadius: _rs.s(16),
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: _rs.sp(16),
  },
  materialInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: _rs.sp(12),
  },
  materialIcon: {
    width: _rs.s(48),
    height: _rs.s(48),
    borderRadius: _rs.s(24),
    justifyContent: "center",
    alignItems: "center",
  },
  materialDetails: {
    flex: 1,
  },
  materialType: {
    fontSize: _rs.fs(16),
    fontWeight: "700",
    marginBottom: _rs.sp(2),
  },
  quantity: {
    fontSize: _rs.fs(13),
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(6),
    borderRadius: _rs.s(8),
    gap: _rs.sp(4),
  },
  statusText: {
    fontSize: _rs.fs(11),
    fontWeight: "600",
  },
  cardContent: {
    gap: _rs.sp(12),
    marginBottom: _rs.sp(16),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(8),
  },
  infoText: {
    fontSize: _rs.fs(14),
    flex: 1,
  },
  descriptionSection: {
    paddingTop: _rs.sp(8),
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  descriptionLabel: {
    fontSize: _rs.fs(12),
    marginBottom: _rs.sp(4),
  },
  descriptionText: {
    fontSize: _rs.fs(14),
    lineHeight: _rs.fs(20),
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: _rs.sp(14),
    borderRadius: _rs.s(12),
    gap: _rs.sp(8),
  },
  acceptButtonText: {
    fontSize: _rs.fs(15),
    fontWeight: "600",
    color: "#FFFFFF",
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: _rs.sp(14),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    gap: _rs.sp(8),
  },
  viewButtonText: {
    fontSize: _rs.fs(15),
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: _rs.sp(60),
    paddingHorizontal: _rs.sp(32),
  },
  emptyText: {
    fontSize: _rs.fs(16),
    marginTop: _rs.sp(16),
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: _rs.fs(13),
    marginTop: _rs.sp(8),
    textAlign: "center",
  },
});
