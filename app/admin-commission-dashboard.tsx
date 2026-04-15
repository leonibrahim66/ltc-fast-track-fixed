/**
 * Admin Commission Dashboard (DB-backed)
 *
 * Reads live data from:
 *   - paymentService.adminCommissionStats  → total / daily / monthly commission
 *   - paymentService.adminAllTransactions  → per-transaction commission breakdown
 *   - paymentService.platformSummary       → platform wallet summary
 */
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";

import { getStaticResponsive } from "@/hooks/use-responsive";
// ─── Types ────────────────────────────────────────────────────────────────────

interface CommissionStats {
  totalCommission: number;
  dailyCommission: number;
  monthlyCommission: number;
  totalTransactions: number;
  completedTransactions: number;
  avgCommissionPerTransaction: number;
  byServiceType: { serviceType: string; total: number; count: number }[];
}

interface TxnRow {
  id: number;
  referenceId: string;
  serviceType: string;
  transactionSource?: string;
  amountTotal: string;
  platformCommission: string;
  providerAmount: string;
  status: string;
  createdAt: string;
  payerId?: number;
  providerId?: number;
}

interface PlatformSummary {
  totalCommissionEarned: number;
  availableBalance: number;
  totalWithdrawn: number;
}

type ActiveTab = "overview" | "transactions" | "breakdown";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return `ZMW ${isNaN(n) ? "0.00" : n.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-ZM", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function serviceLabel(type: string): string {
  const map: Record<string, string> = {
    garbage: "Waste Collection",
    carrier: "Carrier",
    subscription: "Subscription",
    unknown: "Other",
  };
  return map[type] ?? type;
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
    case "released":
      return "#22C55E";
    case "pending":
    case "processing":
      return "#F59E0B";
    case "failed":
    case "cancelled":
      return "#EF4444";
    default:
      return "#687076";
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminCommissionDashboardScreen() {
  const router = useRouter();
  const colors = useColors();

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [stats, setStats] = useState<CommissionStats | null>(null);
  const [transactions, setTransactions] = useState<TxnRow[]>([]);
  const [platformSummary, setPlatformSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);

      const [statsRes, txnsRes, summaryRes] = await Promise.allSettled([
        apiCall(
          "/api/trpc/paymentService.adminCommissionStats?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D"
        ),
        apiCall(
          "/api/trpc/paymentService.adminAllTransactions?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A200%7D%7D%7D"
        ),
        apiCall(
          "/api/trpc/paymentService.platformSummary?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D"
        ),
      ]);

      if (statsRes.status === "fulfilled") {
        const raw = statsRes.value as any;
        setStats(raw?.[0]?.result?.data?.json ?? raw);
      }
      if (txnsRes.status === "fulfilled") {
        const raw = txnsRes.value as any;
        const data = raw?.[0]?.result?.data?.json ?? raw;
        setTransactions(Array.isArray(data) ? data : []);
      }
      if (summaryRes.status === "fulfilled") {
        const raw = summaryRes.value as any;
        setPlatformSummary(raw?.[0]?.result?.data?.json ?? raw);
      }
    } catch {
      setError("Unable to load commission data. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ─── Stat Card ──────────────────────────────────────────────────────────────

  const StatCard = ({
    label,
    value,
    icon,
    color,
  }: {
    label: string;
    value: string;
    icon: string;
    color: string;
  }) => (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <MaterialIcons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );

  // ─── Overview Header ─────────────────────────────────────────────────────────

  const renderOverviewHeader = () => (
    <View style={{ padding: 16, gap: 16 }}>
      {platformSummary && (
        <View style={[styles.walletCard, { backgroundColor: "#0a7ea4" }]}>
          <Text style={styles.walletTitle}>Platform Wallet</Text>
          <Text style={styles.walletAmount}>
            {formatCurrency(platformSummary.totalCommissionEarned)}
          </Text>
          <Text style={styles.walletSub}>Total Commission Earned</Text>
          <View style={styles.walletRow}>
            <View>
              <Text style={styles.walletSubLabel}>Available</Text>
              <Text style={styles.walletSubValue}>
                {formatCurrency(platformSummary.availableBalance)}
              </Text>
            </View>
            <View>
              <Text style={styles.walletSubLabel}>Withdrawn</Text>
              <Text style={styles.walletSubValue}>
                {formatCurrency(platformSummary.totalWithdrawn)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {stats && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Commission Summary
          </Text>
          <View style={styles.statsGrid}>
            <StatCard
              label="Today"
              value={formatCurrency(stats.dailyCommission)}
              icon="today"
              color="#22C55E"
            />
            <StatCard
              label="This Month"
              value={formatCurrency(stats.monthlyCommission)}
              icon="calendar-month"
              color="#0a7ea4"
            />
            <StatCard
              label="All Time"
              value={formatCurrency(stats.totalCommission)}
              icon="account-balance-wallet"
              color="#8B5CF6"
            />
            <StatCard
              label="Avg / Txn"
              value={formatCurrency(stats.avgCommissionPerTransaction)}
              icon="trending-up"
              color="#F59E0B"
            />
          </View>

          <View
            style={[
              styles.countRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.countItem}>
              <Text style={[styles.countValue, { color: colors.foreground }]}>
                {stats.totalTransactions}
              </Text>
              <Text style={[styles.countLabel, { color: colors.muted }]}>Total Txns</Text>
            </View>
            <View style={[styles.countDivider, { backgroundColor: colors.border }]} />
            <View style={styles.countItem}>
              <Text style={[styles.countValue, { color: "#22C55E" }]}>
                {stats.completedTransactions}
              </Text>
              <Text style={[styles.countLabel, { color: colors.muted }]}>Completed</Text>
            </View>
            <View style={[styles.countDivider, { backgroundColor: colors.border }]} />
            <View style={styles.countItem}>
              <Text style={[styles.countValue, { color: "#F59E0B" }]}>
                {stats.totalTransactions - stats.completedTransactions}
              </Text>
              <Text style={[styles.countLabel, { color: colors.muted }]}>Pending</Text>
            </View>
          </View>
        </>
      )}

      {!stats && !loading && (
        <View style={styles.emptyState}>
          <MaterialIcons name="info-outline" size={40} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            No commission data yet.{"\n"}Transactions will appear here once payments are processed.
          </Text>
        </View>
      )}
    </View>
  );

  // ─── Transaction Item ────────────────────────────────────────────────────────

  const renderTxnItem = ({ item }: { item: TxnRow }) => (
    <View
      style={[
        styles.txnCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.txnHeader}>
        <View style={styles.txnLeft}>
          <Text
            style={[styles.txnRef, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {item.referenceId ?? `#${item.id}`}
          </Text>
          <Text style={[styles.txnDate, { color: colors.muted }]}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <View
          style={[
            styles.txnBadge,
            { backgroundColor: statusColor(item.status) + "20" },
          ]}
        >
          <Text
            style={[styles.txnBadgeText, { color: statusColor(item.status) }]}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.txnBody}>
        <View style={styles.txnAmountRow}>
          <Text style={[styles.txnAmountLabel, { color: colors.muted }]}>Total</Text>
          <Text style={[styles.txnAmount, { color: colors.foreground }]}>
            {formatCurrency(item.amountTotal)}
          </Text>
        </View>
        <View style={styles.txnAmountRow}>
          <Text style={[styles.txnAmountLabel, { color: colors.muted }]}>
            Commission (10%)
          </Text>
          <Text style={[styles.txnCommission, { color: "#22C55E" }]}>
            +{formatCurrency(item.platformCommission)}
          </Text>
        </View>
        <View style={styles.txnAmountRow}>
          <Text style={[styles.txnAmountLabel, { color: colors.muted }]}>
            Provider Payout
          </Text>
          <Text style={[styles.txnPayout, { color: colors.foreground }]}>
            {formatCurrency(item.providerAmount)}
          </Text>
        </View>
      </View>

      <View style={[styles.txnFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.txnService, { color: colors.muted }]}>
          {serviceLabel(
            item.transactionSource ?? item.serviceType ?? "unknown"
          )}
        </Text>
        {item.payerId && (
          <Text style={[styles.txnIds, { color: colors.muted }]}>
            Payer #{item.payerId} · Provider #{item.providerId}
          </Text>
        )}
      </View>
    </View>
  );

  // ─── Breakdown Header ────────────────────────────────────────────────────────

  const renderBreakdownHeader = () => (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Commission by Service Type
      </Text>
      {stats?.byServiceType && stats.byServiceType.length > 0 ? (
        stats.byServiceType.map((row) => (
          <View
            key={row.serviceType}
            style={[
              styles.breakdownCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View>
              <Text style={[styles.breakdownService, { color: colors.foreground }]}>
                {serviceLabel(row.serviceType)}
              </Text>
              <Text style={[styles.breakdownCount, { color: colors.muted }]}>
                {row.count} transaction{row.count !== 1 ? "s" : ""}
              </Text>
            </View>
            <Text style={[styles.breakdownAmount, { color: "#22C55E" }]}>
              {formatCurrency(row.total)}
            </Text>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <MaterialIcons name="pie-chart-outline" size={40} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            No breakdown data yet.
          </Text>
        </View>
      )}
    </View>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Commission Dashboard
        </Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRefresh();
          }}
        >
          <MaterialIcons name="refresh" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View
        style={[
          styles.tabBar,
          {
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        {(["overview", "transactions", "breakdown"] as ActiveTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabBtn,
              activeTab === tab && {
                borderBottomColor: "#0a7ea4",
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab);
            }}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab ? "#0a7ea4" : colors.muted },
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <MaterialIcons name="warning" size={16} color="#F59E0B" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#0a7ea4" />
          <Text style={[styles.loadingText, { color: colors.muted }]}>
            Loading commission data…
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === "overview" && (
            <FlatList
              data={[]}
              renderItem={null}
              ListHeaderComponent={renderOverviewHeader}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={{ paddingBottom: 32 }}
            />
          )}
          {activeTab === "transactions" && (
            <FlatList
              data={transactions}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderTxnItem}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons
                    name="receipt-long"
                    size={40}
                    color={colors.muted}
                  />
                  <Text style={[styles.emptyText, { color: colors.muted }]}>
                    No transactions yet.
                  </Text>
                </View>
              }
            />
          )}
          {activeTab === "breakdown" && (
            <FlatList
              data={[]}
              renderItem={null}
              ListHeaderComponent={renderBreakdownHeader}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={{ paddingBottom: 32 }}
            />
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(14),
    borderBottomWidth: 0.5,
  },
  backBtn: { padding: _rs.sp(4) },
  refreshBtn: { padding: _rs.sp(4) },
  headerTitle: {
    flex: 1,
    fontSize: _rs.fs(18),
    fontWeight: "700",
    textAlign: "center",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: _rs.sp(12),
    alignItems: "center",
  },
  tabLabel: {
    fontSize: _rs.fs(13),
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(8),
    backgroundColor: "#FEF3C7",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(8),
  },
  errorText: {
    fontSize: _rs.fs(12),
    color: "#92400E",
    flex: 1,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: _rs.sp(12),
  },
  loadingText: { fontSize: _rs.fs(14) },
  walletCard: {
    padding: _rs.sp(20),
    gap: _rs.sp(4),
    borderRadius: _rs.s(16),
  },
  walletTitle: {
    fontSize: _rs.fs(13),
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  walletAmount: {
    fontSize: _rs.fs(28),
    fontWeight: "800",
    color: "#fff",
    marginTop: _rs.sp(4),
  },
  walletSub: {
    fontSize: _rs.fs(12),
    color: "rgba(255,255,255,0.6)",
  },
  walletRow: {
    flexDirection: "row",
    gap: _rs.sp(32),
    marginTop: _rs.sp(12),
  },
  walletSubLabel: {
    fontSize: _rs.fs(11),
    color: "rgba(255,255,255,0.6)",
  },
  walletSubValue: {
    fontSize: _rs.fs(15),
    fontWeight: "700",
    color: "#fff",
  },
  sectionTitle: {
    fontSize: _rs.fs(16),
    fontWeight: "700",
    marginBottom: _rs.sp(4),
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: _rs.sp(12),
  },
  statCard: {
    width: "47%",
    borderRadius: _rs.s(12),
    borderWidth: 0.5,
    padding: _rs.sp(14),
    gap: _rs.sp(6),
  },
  statIcon: {
    width: _rs.s(36),
    height: _rs.s(36),
    borderRadius: _rs.s(10),
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: _rs.fs(16),
    fontWeight: "700",
  },
  statLabel: { fontSize: _rs.fs(12) },
  countRow: {
    flexDirection: "row",
    borderRadius: _rs.s(12),
    borderWidth: 0.5,
    overflow: "hidden",
  },
  countItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: _rs.sp(14),
    gap: _rs.sp(4),
  },
  countDivider: { width: 0.5 },
  countValue: {
    fontSize: _rs.fs(20),
    fontWeight: "800",
  },
  countLabel: { fontSize: _rs.fs(11) },
  txnCard: {
    borderRadius: _rs.s(12),
    borderWidth: 0.5,
    overflow: "hidden",
    marginBottom: _rs.sp(12),
  },
  txnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: _rs.sp(12),
    paddingBottom: _rs.sp(8),
  },
  txnLeft: { flex: 1, gap: _rs.sp(2) },
  txnRef: { fontSize: _rs.fs(13), fontWeight: "600" },
  txnDate: { fontSize: _rs.fs(11) },
  txnBadge: {
    paddingHorizontal: _rs.sp(8),
    paddingVertical: _rs.sp(3),
    borderRadius: _rs.s(20),
  },
  txnBadgeText: { fontSize: _rs.fs(11), fontWeight: "600" },
  txnBody: {
    paddingHorizontal: _rs.sp(12),
    paddingBottom: _rs.sp(8),
    gap: _rs.sp(4),
  },
  txnAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  txnAmountLabel: { fontSize: _rs.fs(12) },
  txnAmount: { fontSize: _rs.fs(13), fontWeight: "600" },
  txnCommission: { fontSize: _rs.fs(13), fontWeight: "700" },
  txnPayout: { fontSize: _rs.fs(13), fontWeight: "600" },
  txnFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(8),
  },
  txnService: { fontSize: _rs.fs(11) },
  txnIds: { fontSize: _rs.fs(10) },
  breakdownCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: _rs.s(12),
    borderWidth: 0.5,
    padding: _rs.sp(14),
  },
  breakdownService: { fontSize: _rs.fs(15), fontWeight: "600" },
  breakdownCount: { fontSize: _rs.fs(12) },
  breakdownAmount: { fontSize: _rs.fs(18), fontWeight: "800" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: _rs.sp(48),
    gap: _rs.sp(12),
  },
  emptyText: {
    fontSize: _rs.fs(14),
    textAlign: "center",
    lineHeight: _rs.fs(22),
  },
});
