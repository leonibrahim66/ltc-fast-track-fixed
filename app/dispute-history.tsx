import { useState, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import {
  useDisputes,
  DISPUTE_TYPES,
  DISPUTE_STATUS_LABELS,
  RESOLUTION_TYPES,
  DisputeStatus,
} from "@/lib/disputes-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
type FilterStatus = "all" | DisputeStatus;

export default function DisputeHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { disputes, isLoading, refreshDisputes, getDisputesByUserId } = useDisputes();
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>("all");
  const [refreshing, setRefreshing] = useState(false);

  const userDisputes = useMemo(() => {
    if (!user) return [];
    return getDisputesByUserId(user.id);
  }, [user, disputes, getDisputesByUserId]);

  const filteredDisputes = useMemo(() => {
    if (selectedFilter === "all") return userDisputes;
    return userDisputes.filter((d) => d.status === selectedFilter);
  }, [userDisputes, selectedFilter]);

  const stats = useMemo(() => {
    return {
      total: userDisputes.length,
      open: userDisputes.filter((d) => d.status === "open").length,
      investigating: userDisputes.filter((d) => d.status === "investigating").length,
      resolved: userDisputes.filter((d) => d.status === "resolved").length,
      rejected: userDisputes.filter((d) => d.status === "rejected").length,
    };
  }, [userDisputes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshDisputes();
    setRefreshing(false);
  };

  const filterOptions: { key: FilterStatus; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "open", label: "Open", count: stats.open },
    { key: "investigating", label: "Investigating", count: stats.investigating },
    { key: "resolved", label: "Resolved", count: stats.resolved },
    { key: "rejected", label: "Rejected", count: stats.rejected },
  ];

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View className="flex-row items-center px-6 pt-4 pb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4"
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#11181C" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">My Disputes</Text>
            <Text className="text-muted">Track your reported issues</Text>
          </View>
        </View>

        {/* Stats Summary */}
        <View className="px-6 mb-6">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-yellow-50 rounded-xl p-3 border border-yellow-200">
              <Text className="text-yellow-600 text-xs">Open</Text>
              <Text className="text-yellow-700 text-xl font-bold">{stats.open}</Text>
            </View>
            <View className="flex-1 bg-blue-50 rounded-xl p-3 border border-blue-200">
              <Text className="text-blue-600 text-xs">Investigating</Text>
              <Text className="text-blue-700 text-xl font-bold">{stats.investigating}</Text>
            </View>
            <View className="flex-1 bg-green-50 rounded-xl p-3 border border-green-200">
              <Text className="text-green-600 text-xs">Resolved</Text>
              <Text className="text-green-700 text-xl font-bold">{stats.resolved}</Text>
            </View>
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="px-6 mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {filterOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setSelectedFilter(option.key)}
                  className={`px-4 py-2 rounded-full flex-row items-center ${
                    selectedFilter === option.key
                      ? "bg-primary"
                      : "bg-surface border border-border"
                  }`}
                >
                  <Text
                    className={`font-medium ${
                      selectedFilter === option.key ? "text-white" : "text-foreground"
                    }`}
                  >
                    {option.label}
                  </Text>
                  {option.count > 0 && (
                    <View
                      className={`ml-2 px-2 py-0.5 rounded-full ${
                        selectedFilter === option.key ? "bg-white/20" : "bg-gray-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          selectedFilter === option.key ? "text-white" : "text-muted"
                        }`}
                      >
                        {option.count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Disputes List */}
        <View className="px-6">
          {isLoading ? (
            <View className="bg-surface rounded-xl p-8 border border-border items-center">
              <Text className="text-muted">Loading disputes...</Text>
            </View>
          ) : filteredDisputes.length === 0 ? (
            <View className="bg-surface rounded-xl p-8 border border-border items-center">
              <MaterialIcons name="gavel" size={48} color="#9BA1A6" />
              <Text className="text-lg font-medium text-foreground mt-4">
                No Disputes Found
              </Text>
              <Text className="text-muted text-center mt-2">
                {selectedFilter === "all"
                  ? "You have not reported any issues yet."
                  : `No ${selectedFilter} disputes found.`}
              </Text>
            </View>
          ) : (
            filteredDisputes.map((dispute) => {
              const typeInfo = DISPUTE_TYPES[dispute.type];
              const statusInfo = DISPUTE_STATUS_LABELS[dispute.status];
              const resolutionInfo = dispute.resolution
                ? RESOLUTION_TYPES[dispute.resolution]
                : null;

              return (
                <TouchableOpacity
                  key={dispute.id}
                  onPress={() =>
                    router.push({
                      pathname: "/dispute-detail",
                      params: { disputeId: dispute.id },
                    })
                  }
                  className="bg-surface rounded-xl p-4 border border-border mb-3"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: `${statusInfo.color}20` }}
                      >
                        <MaterialIcons
                          name={typeInfo.icon as any}
                          size={20}
                          color={statusInfo.color}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-foreground">
                          {typeInfo.label}
                        </Text>
                        <Text className="text-xs text-muted">
                          Pickup #{dispute.pickupId.slice(-6)}
                        </Text>
                      </View>
                    </View>
                    <View
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: `${statusInfo.color}20` }}
                    >
                      <Text
                        className="text-xs font-medium"
                        style={{ color: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-muted text-sm mb-3" numberOfLines={2}>
                    {dispute.description}
                  </Text>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <MaterialIcons name="schedule" size={14} color="#6B7280" />
                      <Text className="text-xs text-muted ml-1">
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </Text>
                      {dispute.photoEvidence && dispute.photoEvidence.length > 0 && (
                        <View className="flex-row items-center ml-3">
                          <MaterialIcons name="photo" size={14} color="#6B7280" />
                          <Text className="text-xs text-muted ml-1">
                            {dispute.photoEvidence.length} photo
                            {dispute.photoEvidence.length > 1 ? "s" : ""}
                          </Text>
                        </View>
                      )}
                    </View>

                    {resolutionInfo && (
                      <View className="flex-row items-center">
                        <MaterialIcons
                          name={resolutionInfo.icon as any}
                          size={14}
                          color="#22C55E"
                        />
                        <Text className="text-xs text-green-600 ml-1">
                          {resolutionInfo.label}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Help Section */}
        <View className="px-6 mt-6">
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row items-center mb-3">
              <MaterialIcons name="help-outline" size={20} color="#3B82F6" />
              <Text className="font-medium text-foreground ml-2">Need Help?</Text>
            </View>
            <Text className="text-muted text-sm mb-3">
              If you have questions about a dispute or need urgent assistance, contact
              our support team.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/contact-us")}
              className="flex-row items-center"
            >
              <Text className="text-primary font-medium">Contact Support</Text>
              <MaterialIcons name="chevron-right" size={20} color="#22C55E" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  backButton: {
    padding: _rs.sp(8),
  },
});
