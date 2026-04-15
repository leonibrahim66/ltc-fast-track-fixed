/**
 * Admin — Driver Invite Codes
 *
 * Admin visibility: view all invite codes across all zones.
 * Read-only for zone-scoped admin; full control for super admin.
 */
import { useState, useCallback } from "react";
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
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "expo-router";
import { getStaticResponsive } from "@/hooks/use-responsive";
import {
  useInviteCodes,
  type DriverInviteCode,
  getInviteCodeStatus,
} from "@/lib/invite-codes-context";

type FilterType = "all" | "active" | "expired" | "disabled" | "exhausted";

function statusColor(status: ReturnType<typeof getInviteCodeStatus>): string {
  switch (status) {
    case "active": return "#22C55E";
    case "expired": return "#F59E0B";
    case "disabled": return "#9BA1A6";
    case "exhausted": return "#EF4444";
  }
}

function statusLabel(status: ReturnType<typeof getInviteCodeStatus>): string {
  switch (status) {
    case "active": return "Active";
    case "expired": return "Expired";
    case "disabled": return "Disabled";
    case "exhausted": return "Limit Reached";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "No expiry";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminInviteCodesScreen() {
  const router = useRouter();
  const { codes, isLoading, loadCodes } = useInviteCodes();
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCodes();
    }, [loadCodes])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCodes();
    setRefreshing(false);
  };

  const filtered = codes.filter((ic) => {
    const st = getInviteCodeStatus(ic);
    if (filter !== "all" && st !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        ic.code.toLowerCase().includes(q) ||
        ic.zoneManagerName.toLowerCase().includes(q) ||
        (ic.zoneId ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: codes.length,
    active: codes.filter((c) => getInviteCodeStatus(c) === "active").length,
    expired: codes.filter((c) => getInviteCodeStatus(c) === "expired").length,
    disabled: codes.filter((c) => getInviteCodeStatus(c) === "disabled").length,
    exhausted: codes.filter((c) => getInviteCodeStatus(c) === "exhausted").length,
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "active", label: `Active (${counts.active})` },
    { key: "expired", label: `Expired (${counts.expired})` },
    { key: "disabled", label: `Disabled (${counts.disabled})` },
    { key: "exhausted", label: `Limit Reached (${counts.exhausted})` },
  ];

  const renderItem = ({ item: ic }: { item: DriverInviteCode }) => {
    const st = getInviteCodeStatus(ic);
    const color = statusColor(st);
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{ic.code}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: color + "20" }]}>
            <Text style={[styles.badgeText, { color }]}>{statusLabel(st)}</Text>
          </View>
        </View>
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <MaterialIcons name="manage-accounts" size={14} color="#687076" />
            <Text style={styles.metaText} numberOfLines={1}>
              {ic.zoneManagerName}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialIcons name="location-on" size={14} color="#687076" />
            <Text style={styles.metaText}>
              {ic.zoneId ? `Zone ${ic.zoneId.slice(-6)}` : "No zone assigned"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialIcons name="people" size={14} color="#687076" />
            <Text style={styles.metaText}>
              {ic.usedCount} used
              {ic.usageLimit !== null ? ` / ${ic.usageLimit} limit` : " (unlimited)"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialIcons name="schedule" size={14} color="#687076" />
            <Text style={styles.metaText}>Expires: {formatDate(ic.expiresAt)}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialIcons name="calendar-today" size={14} color="#687076" />
            <Text style={styles.metaText}>
              Created: {new Date(ic.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Driver Invite Codes</Text>
          <Text style={styles.headerSub}>
            {codes.length} total across all zones
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={20} color="#9BA1A6" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by code, manager, or zone..."
          placeholderTextColor="#9BA1A6"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <MaterialIcons name="close" size={18} color="#9BA1A6" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <FlatList
        horizontal
        data={filters}
        keyExtractor={(f) => f.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, filter === f.key && styles.chipTextActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#0a7ea4" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="vpn-key" size={48} color="#9BA1A6" />
              <Text style={styles.emptyTitle}>No Invite Codes Found</Text>
              <Text style={styles.emptySub}>
                {search
                  ? "Try a different search term."
                  : "Zone Managers generate invite codes from their Drivers tab."}
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
    backgroundColor: "#EA580C",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(16),
    paddingTop: _rs.sp(12),
    paddingBottom: _rs.sp(16),
    gap: _rs.sp(12),
  },
  backBtn: {
    width: _rs.s(36),
    height: _rs.s(36),
    borderRadius: _rs.s(18),
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: _rs.fs(20), fontWeight: "700" },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: _rs.fs(13), marginTop: _rs.sp(2) },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    margin: _rs.sp(16),
    backgroundColor: "#F5F5F5",
    borderRadius: _rs.s(12),
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(10),
    gap: _rs.sp(8),
  },
  searchInput: { flex: 1, fontSize: _rs.fs(15), color: "#11181C" },
  filterRow: { paddingHorizontal: _rs.sp(16), paddingBottom: _rs.sp(12), gap: _rs.sp(8) },
  chip: {
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(7),
    borderRadius: _rs.s(20),
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: "#FFF0E8", borderColor: "#EA580C" },
  chipText: { fontSize: _rs.fs(13), color: "#687076", fontWeight: "500" },
  chipTextActive: { color: "#EA580C", fontWeight: "700" },
  list: { paddingHorizontal: _rs.sp(16), paddingBottom: _rs.sp(32) },
  card: {
    backgroundColor: "#fff",
    borderRadius: _rs.s(12),
    padding: _rs.sp(16),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(10),
    marginBottom: _rs.sp(12),
  },
  codeBox: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    borderRadius: _rs.s(8),
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(8),
  },
  codeText: {
    fontSize: _rs.fs(20),
    fontWeight: "800",
    color: "#11181C",
    letterSpacing: 3,
  },
  badge: { borderRadius: _rs.s(8), paddingHorizontal: _rs.sp(10), paddingVertical: _rs.sp(4) },
  badgeText: { fontSize: _rs.fs(12), fontWeight: "700" },
  metaGrid: { gap: _rs.sp(6) },
  metaItem: { flexDirection: "row", alignItems: "center", gap: _rs.sp(6) },
  metaText: { fontSize: _rs.fs(13), color: "#687076", flex: 1 },
  empty: { alignItems: "center", paddingVertical: _rs.sp(60), gap: _rs.sp(8) },
  emptyTitle: { fontSize: _rs.fs(16), fontWeight: "600", color: "#11181C", marginTop: _rs.sp(8) },
  emptySub: {
    fontSize: _rs.fs(13),
    color: "#687076",
    textAlign: "center",
    maxWidth: 260,
  },
});
