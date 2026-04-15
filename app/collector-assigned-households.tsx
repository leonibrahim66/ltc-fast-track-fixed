import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
type FilterType = "all" | "active" | "inactive";

interface Household {
  id: string;
  name: string;
  address: string;
  subscriptionStatus: "active" | "expired";
  paymentStatus: "paid" | "pending" | "overdue";
  zoneId: string;
  subscriptionPlan?: string;
  monthlyAmount?: number;
}

export default function CollectorAssignedHouseholdsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [filteredHouseholds, setFilteredHouseholds] = useState<Household[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHouseholds();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [filter, households]);

  const loadHouseholds = async () => {
    setLoading(true);
    try {
      // TODO: Replace with backend API call
      // const response = await fetch(`/api/collector/households?zone_id=${user?.zoneId}`);
      // const data = await response.json();
      // setHouseholds(data.households);

      // Temporary: Load from backend when ready
      // For now, this will be empty until backend integration
      setHouseholds([]);
    } catch (e) {
      console.error("Error loading households:", e);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    let filtered = households;
    
    if (filter === "active") {
      filtered = households.filter((h) => h.subscriptionStatus === "active");
    } else if (filter === "inactive") {
      filtered = households.filter((h) => h.subscriptionStatus === "expired");
    }
    
    setFilteredHouseholds(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHouseholds();
    setRefreshing(false);
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "#10B981";
      case "pending":
        return "#F59E0B";
      case "overdue":
        return "#EF4444";
      default:
        return "#9BA1A6";
    }
  };

  const getSubscriptionStatusColor = (status: string) => {
    return status === "active" ? "#10B981" : "#9BA1A6";
  };

  const filterOptions: Array<{ key: FilterType; label: string }> = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
  ];

  const renderHousehold = ({ item }: { item: Household }) => (
    <TouchableOpacity
      onPress={() => {
        // TODO: Navigate to household details
        // router.push(`/household-details/${item.id}` as any);
      }}
      activeOpacity={0.7}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={[styles.householdName, { color: colors.foreground }]}>
            {item.name}
          </Text>
          <View style={styles.addressRow}>
            <MaterialIcons name="location-on" size={14} color={colors.muted} />
            <Text style={[styles.address, { color: colors.muted }]} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusItem}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getSubscriptionStatusColor(item.subscriptionStatus)}15` },
            ]}
          >
            <MaterialIcons
              name={item.subscriptionStatus === "active" ? "check-circle" : "cancel"}
              size={14}
              color={getSubscriptionStatusColor(item.subscriptionStatus)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getSubscriptionStatusColor(item.subscriptionStatus) },
              ]}
            >
              {item.subscriptionStatus === "active" ? "Active" : "Expired"}
            </Text>
          </View>
        </View>

        <View style={styles.statusItem}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getPaymentStatusColor(item.paymentStatus)}15` },
            ]}
          >
            <MaterialIcons
              name={
                item.paymentStatus === "paid"
                  ? "check"
                  : item.paymentStatus === "pending"
                  ? "schedule"
                  : "error"
              }
              size={14}
              color={getPaymentStatusColor(item.paymentStatus)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getPaymentStatusColor(item.paymentStatus) },
              ]}
            >
              {item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      {item.subscriptionPlan && (
        <View style={styles.planRow}>
          <Text style={[styles.planText, { color: colors.muted }]}>
            {item.subscriptionPlan} - K{item.monthlyAmount?.toFixed(2)}/month
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assigned Households</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Zone Info */}
      <View style={styles.zoneSection}>
        <View
          style={[
            styles.zoneCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <MaterialIcons name="location-city" size={24} color={colors.primary} />
          <View style={styles.zoneInfo}>
            <Text style={[styles.zoneLabel, { color: colors.muted }]}>
              Your Assigned Zone
            </Text>
            <Text style={[styles.zoneName, { color: colors.foreground }]}>
              {user?.zone || "Zone not assigned"}
            </Text>
          </View>
          <View style={styles.zoneCount}>
            <Text style={[styles.countNumber, { color: colors.primary }]}>
              {filteredHouseholds.length}
            </Text>
            <Text style={[styles.countLabel, { color: colors.muted }]}>
              Households
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <View style={styles.filterButtons}>
          {filterOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              onPress={() => setFilter(option.key)}
              style={[
                styles.filterButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                filter === option.key && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  { color: colors.muted },
                  filter === option.key && { color: "#FFFFFF" },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Households List */}
      <FlatList
        data={filteredHouseholds}
        keyExtractor={(item) => item.id}
        renderItem={renderHousehold}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="home" size={64} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {loading
                ? "Loading households..."
                : filter === "all"
                ? "No households assigned to your zone yet"
                : `No ${filter} households`}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.muted }]}>
              Backend integration required to load zone-based households
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
  zoneSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(16),
  },
  zoneCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(16),
    borderWidth: 1,
    gap: _rs.sp(12),
  },
  zoneInfo: {
    flex: 1,
  },
  zoneLabel: {
    fontSize: _rs.fs(12),
    marginBottom: _rs.sp(2),
  },
  zoneName: {
    fontSize: _rs.fs(16),
    fontWeight: "700",
  },
  zoneCount: {
    alignItems: "center",
  },
  countNumber: {
    fontSize: _rs.fs(24),
    fontWeight: "700",
  },
  countLabel: {
    fontSize: _rs.fs(11),
  },
  filterSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(16),
  },
  filterButtons: {
    flexDirection: "row",
    gap: _rs.sp(12),
  },
  filterButton: {
    flex: 1,
    padding: _rs.sp(12),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    alignItems: "center",
  },
  filterButtonText: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
  },
  card: {
    marginHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(12),
    padding: _rs.sp(16),
    borderRadius: _rs.s(16),
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: _rs.sp(12),
  },
  cardInfo: {
    flex: 1,
  },
  householdName: {
    fontSize: _rs.fs(16),
    fontWeight: "700",
    marginBottom: _rs.sp(4),
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(4),
  },
  address: {
    fontSize: _rs.fs(13),
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    gap: _rs.sp(12),
    marginBottom: _rs.sp(8),
  },
  statusItem: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: _rs.sp(8),
    borderRadius: _rs.s(8),
    gap: _rs.sp(6),
  },
  statusText: {
    fontSize: _rs.fs(12),
    fontWeight: "600",
  },
  planRow: {
    paddingTop: _rs.sp(8),
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  planText: {
    fontSize: _rs.fs(13),
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
