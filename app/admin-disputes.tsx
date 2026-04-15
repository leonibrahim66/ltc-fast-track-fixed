import { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  RefreshControl,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { useDisputes, Dispute, DisputeStatus, DISPUTE_TYPES } from "@/lib/disputes-context";
import { useNotifications } from "@/lib/notifications-context";
import { useITRealtime } from "@/lib/it-realtime-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type StatusFilter = "all" | DisputeStatus;

export default function AdminDisputesScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, refreshStats } = useAdmin();
  const { disputes, updateDispute, refreshDisputes } = useDisputes();
  const { addNotification } = useNotifications();
  const { addEvent } = useITRealtime();
  const [filteredDisputes, setFilteredDisputes] = useState<Dispute[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
  }, [isAdminAuthenticated]);

  // Real-time: reload disputes every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshDisputes();
    }, [refreshDisputes])
  );

  useEffect(() => {
    filterDisputes();
  }, [disputes, searchQuery, statusFilter]);

  const filterDisputes = () => {
    let filtered = [...disputes];

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.id.toLowerCase().includes(query) ||
          d.pickupId.toLowerCase().includes(query) ||
          d.type.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredDisputes(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDisputes();
    await refreshStats();
    setRefreshing(false);
  };

  const getStatusStyle = (status: DisputeStatus) => {
    switch (status) {
      case "open":
        return { bg: "bg-warning/10", text: "text-warning", color: "#F59E0B" };
      case "investigating":
        return { bg: "bg-blue-500/10", text: "text-blue-500", color: "#3B82F6" };
      case "resolved":
        return { bg: "bg-success/10", text: "text-success", color: "#22C55E" };
      case "rejected":
        return { bg: "bg-error/10", text: "text-error", color: "#EF4444" };
      default:
        return { bg: "bg-muted/10", text: "text-muted", color: "#9BA1A6" };
    }
  };

  const getIssueTypeLabel = (type: string) => {
    return DISPUTE_TYPES[type as keyof typeof DISPUTE_TYPES]?.label || type;
  };

  const handleStatusUpdate = async (status: DisputeStatus) => {
    if (!selectedDispute) return;

    const updates: Partial<Dispute> = { status };
    if (adminNote.trim()) {
      updates.resolutionNotes = adminNote.trim();
    }
    if (status === "resolved" || status === "rejected") {
      updates.resolvedAt = new Date().toISOString();
      updates.resolvedBy = "admin";
    }

    await updateDispute(selectedDispute.id, updates);

    // Send notification to user when dispute is resolved or rejected
    if (status === "resolved" || status === "rejected") {
      await addNotification({
        type: "system",
        title: status === "resolved" ? "Dispute Resolved" : "Dispute Closed",
        message: status === "resolved"
          ? `Your dispute has been resolved.${adminNote.trim() ? ` Admin note: ${adminNote.trim()}` : " Thank you for your patience."}`
          : `Your dispute has been closed.${adminNote.trim() ? ` Reason: ${adminNote.trim()}` : " Please contact support for more information."}`,
        data: { referenceId: selectedDispute.id },
      });
      // Emit live event to IT realtime feed
      addEvent({
        type: status === "resolved" ? "pickup_completed" : "pickup_cancelled",
        title: `Dispute ${status === "resolved" ? "Resolved" : "Rejected"}`,
        description: `Dispute #${selectedDispute.id.slice(-6)} — ${getIssueTypeLabel(selectedDispute.type)}`,
        data: { pickupId: selectedDispute.id },
        priority: "medium",
      });
    }

    Alert.alert("Success", `Dispute status updated to ${status}`);
    setShowActionModal(false);
    setSelectedDispute(null);
    setAdminNote("");
    await refreshStats();
  };

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "Open" },
    { id: "investigating", label: "Investigating" },
    { id: "resolved", label: "Resolved" },
    { id: "rejected", label: "Rejected" },
  ];

  const renderDisputeItem = ({ item }: { item: Dispute }) => {
    const statusStyle = getStatusStyle(item.status);

    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedDispute(item);
          setShowActionModal(true);
        }}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
                <Text className="text-foreground font-semibold">
              {getIssueTypeLabel(item.type)}
            </Text>
            <Text className="text-muted text-xs">ID: {item.id}</Text>
          </View>
          <View className={`px-3 py-1 rounded-full ${statusStyle.bg}`}>
            <Text className={`text-xs font-medium capitalize ${statusStyle.text}`}>
              {item.status}
            </Text>
          </View>
        </View>

        <Text className="text-muted text-sm mb-2" numberOfLines={2}>
          {item.description}
        </Text>

        <View className="flex-row items-center justify-between pt-2 border-t border-border">
          <View className="flex-row items-center">
            <MaterialIcons name="receipt" size={14} color="#9BA1A6" />
            <Text className="text-muted text-xs ml-1">Pickup: {item.pickupId}</Text>
          </View>
          <Text className="text-muted text-xs">
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {item.photoEvidence && item.photoEvidence.length > 0 && (
          <View className="flex-row items-center mt-2">
            <MaterialIcons name="photo-library" size={14} color="#3B82F6" />
            <Text className="text-blue-500 text-xs ml-1">
              {item.photoEvidence.length} photo(s) attached
            </Text>
          </View>
        )}

        {item.resolutionNotes && (
          <View className="mt-2 bg-background rounded-lg p-2">
            <Text className="text-xs text-muted">
              Admin Note: {item.resolutionNotes}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-4">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-4"
          >
            <MaterialIcons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Disputes & Complaints</Text>
            <Text className="text-muted">{filteredDisputes.length} disputes found</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface rounded-xl border border-border px-4 mb-4">
          <MaterialIcons name="search" size={20} color="#9BA1A6" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by ID or issue type..."
            placeholderTextColor="#9BA1A6"
            className="flex-1 py-3 px-3 text-foreground"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialIcons name="close" size={20} color="#9BA1A6" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row">
            {statusFilters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setStatusFilter(filter.id)}
                className={`px-4 py-2 rounded-full mr-2 ${
                  statusFilter === filter.id ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`font-medium ${
                    statusFilter === filter.id ? "text-white" : "text-muted"
                  }`}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Disputes List */}
      <FlatList
        data={filteredDisputes}
        renderItem={renderDisputeItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <MaterialIcons name="gavel" size={48} color="#9BA1A6" />
            <Text className="text-muted text-center mt-4">No disputes found</Text>
          </View>
        }
      />

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-foreground">Manage Dispute</Text>
              <TouchableOpacity onPress={() => setShowActionModal(false)}>
                <MaterialIcons name="close" size={24} color="#9BA1A6" />
              </TouchableOpacity>
            </View>

            {selectedDispute && (
              <>
                <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                  <Text className="text-foreground font-semibold mb-1">
                    {getIssueTypeLabel(selectedDispute.type)}
                  </Text>
                  <Text className="text-muted text-sm">{selectedDispute.description}</Text>
                  <View className="flex-row mt-2">
                    <Text className="text-xs text-muted">
                      Current Status:{" "}
                      <Text className="font-medium capitalize">{selectedDispute.status}</Text>
                    </Text>
                  </View>
                </View>

                {/* Admin Note Input */}
                <View className="mb-4">
                  <Text className="text-foreground font-medium mb-2">Add Note (Optional)</Text>
                  <TextInput
                    value={adminNote}
                    onChangeText={setAdminNote}
                    placeholder="Enter admin note..."
                    placeholderTextColor="#9BA1A6"
                    multiline
                    numberOfLines={3}
                    className="bg-surface rounded-xl border border-border p-4 text-foreground"
                    textAlignVertical="top"
                  />
                </View>

                {/* Action Buttons */}
                <View className="flex-row flex-wrap -mx-1">
                  <TouchableOpacity
                    onPress={() => handleStatusUpdate("investigating")}
                    className="w-1/2 p-1"
                  >
                    <View className="bg-blue-500 rounded-xl py-3 items-center">
                      <MaterialIcons name="search" size={20} color="#fff" />
                      <Text className="text-white font-medium mt-1">Investigate</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleStatusUpdate("resolved")}
                    className="w-1/2 p-1"
                  >
                    <View className="bg-success rounded-xl py-3 items-center">
                      <MaterialIcons name="check-circle" size={20} color="#fff" />
                      <Text className="text-white font-medium mt-1">Resolve</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleStatusUpdate("rejected")}
                    className="w-1/2 p-1"
                  >
                    <View className="bg-error rounded-xl py-3 items-center">
                      <MaterialIcons name="cancel" size={20} color="#fff" />
                      <Text className="text-white font-medium mt-1">Reject</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push(`/dispute-detail?id=${selectedDispute.id}` as any)}
                    className="w-1/2 p-1"
                  >
                    <View className="bg-surface border border-border rounded-xl py-3 items-center">
                      <MaterialIcons name="visibility" size={20} color="#374151" />
                      <Text className="text-foreground font-medium mt-1">View Details</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
