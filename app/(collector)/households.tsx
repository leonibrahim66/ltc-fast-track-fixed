/**
 * Zone Manager Dashboard — Household Management (Section 2)
 *
 * Shows households filtered by zone_id = logged_in_manager.zone_id
 * Filters: Active | Expired | Overdue
 * No ability to change subscription pricing.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { supabase } from "@/lib/supabase";

import { getStaticResponsive } from "@/hooks/use-responsive";
type FilterType = "all" | "active" | "expired" | "overdue";

interface Household {
  id: string;
  name: string;
  address: string;
  subscriptionStatus: string;
  paymentStatus: string;
  lastPickupDate: string | null;
}

const ZONE_GREEN = "#1B5E20";

export default function HouseholdManagementScreen() {
  const colors = useColors();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [households, setHouseholds] = useState<Household[]>([]);
  const [zoneId, setZoneId] = useState<number | null>(null);

  const fetchHouseholds = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Resolve zone
      if (!zoneId) {
        const { data: zoneRow } = await supabase
          .from("zone_collectors")
          .select("zoneId")
          .eq("collectorId", user.id)
          .maybeSingle();
        if (!zoneRow?.zoneId) {
          setLoading(false);
          return;
        }
        setZoneId(zoneRow.zoneId);
      }

      const resolvedZoneId = zoneId;
      if (!resolvedZoneId) return;

      // Fetch households for this zone
      let query = supabase
        .from("subscriptions")
        .select(
          "id, customerName, address, status, paymentStatus, lastPickupDate"
        )
        .eq("zoneId", resolvedZoneId);

      if (filter === "active") query = query.eq("status", "active");
      else if (filter === "expired") query = query.eq("status", "expired");
      else if (filter === "overdue") query = query.eq("paymentStatus", "overdue");

      const { data } = await query.order("customerName", { ascending: true });

      setHouseholds(
        (data ?? []).map((h: any) => ({
          id: h.id.toString(),
          name: h.customerName ?? "Unknown",
          address: h.address ?? "—",
          subscriptionStatus: h.status ?? "unknown",
          paymentStatus: h.paymentStatus ?? "unknown",
          lastPickupDate: h.lastPickupDate ?? null,
        }))
      );
    } catch (err) {
      console.error("[HouseholdManagement] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, zoneId, filter]);

  useEffect(() => {
    fetchHouseholds();
  }, [fetchHouseholds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHouseholds();
    setRefreshing(false);
  }, [fetchHouseholds]);

  const filtered = households.filter(
    (h) =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.address.toLowerCase().includes(search.toLowerCase())
  );

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "expired", label: "Expired" },
    { key: "overdue", label: "Overdue" },
  ];

  function statusColor(status: string) {
    if (status === "active") return "#10B981";
    if (status === "expired") return "#EF4444";
    if (status === "overdue") return "#F59E0B";
    return "#9BA1A6";
  }

  function statusBg(status: string) {
    if (status === "active") return "#D1FAE5";
    if (status === "expired") return "#FEE2E2";
    if (status === "overdue") return "#FEF3C7";
    return "#F3F4F6";
  }

  const renderItem = ({ item }: { item: Household }) => (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardIconWrap}>
          <MaterialIcons name="home" size={22} color={ZONE_GREEN} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: colors.foreground }]}>
            {item.name}
          </Text>
          <Text style={[styles.cardAddress, { color: colors.muted }]}>
            {item.address}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            { backgroundColor: statusBg(item.subscriptionStatus) },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: statusColor(item.subscriptionStatus) },
            ]}
          >
            {item.subscriptionStatus}
          </Text>
        </View>
      </View>
      <View
        style={[styles.cardDivider, { backgroundColor: colors.border }]}
      />
      <View style={styles.cardBottom}>
        <View style={styles.cardMeta}>
          <MaterialIcons name="payment" size={14} color={colors.muted} />
          <Text style={[styles.cardMetaText, { color: colors.muted }]}>
            Payment:{" "}
            <Text style={{ color: statusColor(item.paymentStatus) }}>
              {item.paymentStatus}
            </Text>
          </Text>
        </View>
        <View style={styles.cardMeta}>
          <MaterialIcons
            name="calendar-today"
            size={14}
            color={colors.muted}
          />
          <Text style={[styles.cardMetaText, { color: colors.muted }]}>
            Last pickup:{" "}
            {item.lastPickupDate
              ? new Date(item.lastPickupDate).toLocaleDateString()
              : "N/A"}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: ZONE_GREEN }]}>
        <Text style={styles.headerTitle}>Household Management</Text>
        <Text style={styles.headerSub}>
          {filtered.length} household{filtered.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialIcons name="search" size={20} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by name or address..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <MaterialIcons name="close" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {filterTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              filter === tab.key && {
                borderBottomColor: ZONE_GREEN,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                {
                  color:
                    filter === tab.key ? ZONE_GREEN : colors.muted,
                  fontWeight: filter === tab.key ? "700" : "400",
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator
          color={ZONE_GREEN}
          style={{ marginTop: 40 }}
          size="large"
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ZONE_GREEN}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="home" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No households found
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: _rs.sp(20),
    paddingTop: _rs.sp(20),
    paddingBottom: _rs.sp(20),
  },
  headerTitle: { fontSize: _rs.fs(20), fontWeight: "700", color: "#fff" },
  headerSub: {
    fontSize: _rs.fs(13),
    color: "rgba(255,255,255,0.8)",
    marginTop: _rs.sp(4),
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    margin: _rs.sp(16),
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(10),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    gap: _rs.sp(10),
  },
  searchInput: { flex: 1, fontSize: _rs.fs(15), paddingVertical: 0 },
  filterRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: _rs.sp(8),
  },
  filterTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: _rs.sp(12),
    paddingBottom: _rs.sp(10),
  },
  filterTabText: { fontSize: _rs.fs(14) },
  card: {
    borderRadius: _rs.s(14),
    borderWidth: 1,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(14),
    gap: _rs.sp(12),
  },
  cardIconWrap: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: _rs.fs(15), fontWeight: "600", marginBottom: _rs.sp(2) },
  cardAddress: { fontSize: _rs.fs(13) },
  badge: {
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(4),
    borderRadius: _rs.s(20),
  },
  badgeText: { fontSize: _rs.fs(12), fontWeight: "600", textTransform: "capitalize" },
  cardDivider: { height: 1, marginHorizontal: _rs.sp(14) },
  cardBottom: {
    flexDirection: "row",
    padding: _rs.sp(12),
    paddingHorizontal: _rs.sp(14),
    gap: _rs.sp(16),
  },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: _rs.sp(5) },
  cardMetaText: { fontSize: _rs.fs(12) },
  emptyState: {
    alignItems: "center",
    paddingTop: _rs.sp(60),
    gap: _rs.sp(12),
  },
  emptyText: { fontSize: _rs.fs(16) },
});
