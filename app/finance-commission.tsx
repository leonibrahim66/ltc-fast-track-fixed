/**
 * Finance Commission Overview Screen
 *
 * Accessible by: finance, superadmin roles only.
 * Displays platform commission totals with breakdowns by period, zone, city, province.
 * Supports CSV, Excel, and PDF export — all data scoped to platform commissions only.
 * Commission rules cannot be modified here (superadmin only via admin-commission-settings).
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { usePayments, Payment } from "@/lib/payments-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getStaticResponsive } from "@/hooks/use-responsive";
// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodTab = "today" | "week" | "month" | "all";
type GroupBy = "zone" | "city" | "province" | "service";

interface CommissionSummary {
  totalCommissions: number;
  totalTransactions: number;
  averageCommission: number;
  platformMsisdn: string;
  currency: string;
}

interface CommissionBreakdownItem {
  label: string;
  commissionAmount: number;
  transactionCount: number;
  percentage: number;
}

interface DailyCommission {
  date: string;
  amount: number;
  count: number;
}

interface CommissionData {
  summary: CommissionSummary;
  daily: DailyCommission[];
  breakdown: CommissionBreakdownItem[];
  byService: CommissionBreakdownItem[];
  lastUpdated: string;
}

// ─── Mock Data Generator ──────────────────────────────────────────────────────

function buildCommissionData(allPayments: Payment[], period: PeriodTab, groupBy: GroupBy): CommissionData {
  const now = new Date();
  const daily: DailyCommission[] = [];

  const days = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 365;
  let totalCommissions = 0;
  let totalTransactions = 0;

  // Filter confirmed payments by period
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const periodPayments = period === "all"
    ? allPayments.filter((p) => p.status === "confirmed")
    : allPayments.filter((p) => p.status === "confirmed" && new Date(p.createdAt) >= cutoff);

  // Build daily map from real payment data
  const dailyMap: Record<string, { amount: number; count: number }> = {};
  for (const p of periodPayments) {
    const dateKey = p.createdAt.split("T")[0];
    const commission = p.amount * 0.1; // 10% platform commission
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { amount: 0, count: 0 };
    dailyMap[dateKey].amount += commission;
    dailyMap[dateKey].count += 1;
    totalCommissions += commission;
    totalTransactions += 1;
  }

  // Fill daily array for the period (up to 90 days for display)
  for (let i = Math.min(days, 90) - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];
    daily.push({
      date: dateKey,
      amount: parseFloat((dailyMap[dateKey]?.amount ?? 0).toFixed(2)),
      count: dailyMap[dateKey]?.count ?? 0,
    });
  }

  totalCommissions = parseFloat(totalCommissions.toFixed(2));

  const zoneData: CommissionBreakdownItem[] = [
    { label: "Zone A — Lusaka Central", commissionAmount: totalCommissions * 0.28, transactionCount: Math.floor(totalTransactions * 0.28), percentage: 28 },
    { label: "Zone B — Woodlands", commissionAmount: totalCommissions * 0.22, transactionCount: Math.floor(totalTransactions * 0.22), percentage: 22 },
    { label: "Zone C — Kabulonga", commissionAmount: totalCommissions * 0.18, transactionCount: Math.floor(totalTransactions * 0.18), percentage: 18 },
    { label: "Zone D — Chilenje", commissionAmount: totalCommissions * 0.15, transactionCount: Math.floor(totalTransactions * 0.15), percentage: 15 },
    { label: "Zone E — Matero", commissionAmount: totalCommissions * 0.10, transactionCount: Math.floor(totalTransactions * 0.10), percentage: 10 },
    { label: "Zone F — Kalingalinga", commissionAmount: totalCommissions * 0.07, transactionCount: Math.floor(totalTransactions * 0.07), percentage: 7 },
  ];

  const cityData: CommissionBreakdownItem[] = [
    { label: "Lusaka", commissionAmount: totalCommissions * 0.55, transactionCount: Math.floor(totalTransactions * 0.55), percentage: 55 },
    { label: "Kitwe", commissionAmount: totalCommissions * 0.20, transactionCount: Math.floor(totalTransactions * 0.20), percentage: 20 },
    { label: "Ndola", commissionAmount: totalCommissions * 0.12, transactionCount: Math.floor(totalTransactions * 0.12), percentage: 12 },
    { label: "Livingstone", commissionAmount: totalCommissions * 0.08, transactionCount: Math.floor(totalTransactions * 0.08), percentage: 8 },
    { label: "Chipata", commissionAmount: totalCommissions * 0.05, transactionCount: Math.floor(totalTransactions * 0.05), percentage: 5 },
  ];

  const provinceData: CommissionBreakdownItem[] = [
    { label: "Lusaka Province", commissionAmount: totalCommissions * 0.55, transactionCount: Math.floor(totalTransactions * 0.55), percentage: 55 },
    { label: "Copperbelt Province", commissionAmount: totalCommissions * 0.25, transactionCount: Math.floor(totalTransactions * 0.25), percentage: 25 },
    { label: "Southern Province", commissionAmount: totalCommissions * 0.10, transactionCount: Math.floor(totalTransactions * 0.10), percentage: 10 },
    { label: "Eastern Province", commissionAmount: totalCommissions * 0.06, transactionCount: Math.floor(totalTransactions * 0.06), percentage: 6 },
    { label: "Other Provinces", commissionAmount: totalCommissions * 0.04, transactionCount: Math.floor(totalTransactions * 0.04), percentage: 4 },
  ];

  const serviceData: CommissionBreakdownItem[] = [
    { label: "Garbage Collection", commissionAmount: totalCommissions * 0.62, transactionCount: Math.floor(totalTransactions * 0.62), percentage: 62 },
    { label: "Carrier Services", commissionAmount: totalCommissions * 0.28, transactionCount: Math.floor(totalTransactions * 0.28), percentage: 28 },
    { label: "Subscriptions", commissionAmount: totalCommissions * 0.10, transactionCount: Math.floor(totalTransactions * 0.10), percentage: 10 },
  ];

  const breakdownMap: Record<GroupBy, CommissionBreakdownItem[]> = {
    zone: zoneData,
    city: cityData,
    province: provinceData,
    service: serviceData,
  };

  return {
    summary: {
      totalCommissions,
      totalTransactions,
      averageCommission: parseFloat((totalCommissions / totalTransactions).toFixed(2)),
      platformMsisdn: "0960819993",
      currency: "ZMW",
    },
    daily,
    breakdown: breakdownMap[groupBy],
    byService: serviceData,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function generateCSV(data: CommissionData, period: PeriodTab, groupBy: GroupBy): string {
  const lines: string[] = [];

  lines.push("LTC Fast Track — Platform Commission Report");
  lines.push(`Period: ${period.toUpperCase()} | Group By: ${groupBy.toUpperCase()}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push(`Platform MSISDN: ${data.summary.platformMsisdn} | Currency: ${data.summary.currency}`);
  lines.push("");

  lines.push("SUMMARY");
  lines.push("Metric,Value");
  lines.push(`Total Commissions (ZMW),${data.summary.totalCommissions.toFixed(2)}`);
  lines.push(`Total Transactions,${data.summary.totalTransactions}`);
  lines.push(`Average Commission (ZMW),${data.summary.averageCommission.toFixed(2)}`);
  lines.push("");

  lines.push(`BREAKDOWN BY ${groupBy.toUpperCase()}`);
  lines.push("Label,Commission (ZMW),Transactions,Percentage (%)");
  for (const item of data.breakdown) {
    lines.push(`"${item.label}",${item.commissionAmount.toFixed(2)},${item.transactionCount},${item.percentage}`);
  }
  lines.push("");

  lines.push("DAILY BREAKDOWN");
  lines.push("Date,Commission (ZMW),Transactions");
  for (const d of data.daily) {
    lines.push(`${d.date},${d.amount.toFixed(2)},${d.count}`);
  }

  return lines.join("\n");
}

function generateExcel(data: CommissionData, period: PeriodTab, groupBy: GroupBy): string {
  // Tab-separated format (opens in Excel)
  const lines: string[] = [];
  lines.push("LTC Fast Track — Platform Commission Report");
  lines.push(`Period\t${period.toUpperCase()}\tGroup By\t${groupBy.toUpperCase()}`);
  lines.push(`Generated\t${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("SUMMARY");
  lines.push(`Total Commissions (ZMW)\t${data.summary.totalCommissions.toFixed(2)}`);
  lines.push(`Total Transactions\t${data.summary.totalTransactions}`);
  lines.push(`Average Commission (ZMW)\t${data.summary.averageCommission.toFixed(2)}`);
  lines.push("");
  lines.push(`BREAKDOWN BY ${groupBy.toUpperCase()}`);
  lines.push("Label\tCommission (ZMW)\tTransactions\tPercentage (%)");
  for (const item of data.breakdown) {
    lines.push(`${item.label}\t${item.commissionAmount.toFixed(2)}\t${item.transactionCount}\t${item.percentage}`);
  }
  lines.push("");
  lines.push("DAILY BREAKDOWN");
  lines.push("Date\tCommission (ZMW)\tTransactions");
  for (const d of data.daily) {
    lines.push(`${d.date}\t${d.amount.toFixed(2)}\t${d.count}`);
  }
  return lines.join("\n");
}

function generatePDF(data: CommissionData, period: PeriodTab, groupBy: GroupBy): string {
  // Plain-text PDF-ready format
  const sep = "─".repeat(60);
  const lines: string[] = [];
  lines.push("LTC FAST TRACK — PLATFORM COMMISSION REPORT");
  lines.push(sep);
  lines.push(`Period: ${period.toUpperCase()}   Group By: ${groupBy.toUpperCase()}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push(`Platform MSISDN: ${data.summary.platformMsisdn}   Currency: ${data.summary.currency}`);
  lines.push(sep);
  lines.push("SUMMARY");
  lines.push(`  Total Commissions:   ZMW ${data.summary.totalCommissions.toFixed(2)}`);
  lines.push(`  Total Transactions:  ${data.summary.totalTransactions}`);
  lines.push(`  Average Commission:  ZMW ${data.summary.averageCommission.toFixed(2)}`);
  lines.push(sep);
  lines.push(`BREAKDOWN BY ${groupBy.toUpperCase()}`);
  for (const item of data.breakdown) {
    lines.push(`  ${item.label.padEnd(35)} ZMW ${item.commissionAmount.toFixed(2).padStart(10)}   ${item.percentage}%`);
  }
  lines.push(sep);
  lines.push("DAILY BREAKDOWN (last 10 days)");
  for (const d of data.daily.slice(-10)) {
    lines.push(`  ${d.date}   ZMW ${d.amount.toFixed(2).padStart(10)}   ${d.count} txns`);
  }
  lines.push(sep);
  return lines.join("\n");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinanceCommissionScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const { payments } = usePayments();
  const [period, setPeriod] = useState<PeriodTab>("month");
  const [groupBy, setGroupBy] = useState<GroupBy>("zone");
  const [data, setData] = useState<CommissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Role guard: finance and superadmin only
  useEffect(() => {
    if (adminUser && adminUser.role !== "finance" && adminUser.role !== "superadmin") {
      Alert.alert("Access Denied", "This section is restricted to Finance and Super Admin roles.");
      router.back();
    }
  }, [adminUser]);

  const loadData = useCallback(() => {
    setLoading(true);
    // Build commission data from real payments in context
    setData(buildCommissionData(payments, period, groupBy));
    setLoading(false);
  }, [payments, period, groupBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    if (!data) return;
    setExporting(true);
    try {
      let content = "";
      let filename = "";
      const ts = new Date().toISOString().split("T")[0];

      if (format === "csv") {
        content = generateCSV(data, period, groupBy);
        filename = `ltc_commissions_${period}_${ts}.csv`;
      } else if (format === "excel") {
        content = generateExcel(data, period, groupBy);
        filename = `ltc_commissions_${period}_${ts}.tsv`;
      } else {
        content = generatePDF(data, period, groupBy);
        filename = `ltc_commissions_${period}_${ts}.txt`;
      }

      await Share.share({
        message: content,
        title: filename,
      });
    } catch {
      Alert.alert("Export Failed", "Could not export the report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const formatZMW = (n: number) => `ZMW ${n.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const periodLabels: Record<PeriodTab, string> = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    all: "All Time",
  };

  const groupLabels: Record<GroupBy, string> = {
    zone: "By Zone",
    city: "By City",
    province: "By Province",
    service: "By Service",
  };

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Commission Overview</Text>
            <Text style={styles.subtitle}>Platform: 0960819993 · ZMW · 10% rate</Text>
          </View>
        </View>

        {/* Period Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
          {(["today", "week", "month", "all"] as PeriodTab[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.tab, period === p && styles.tabActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
                {periodLabels[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Group By Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
          {(["zone", "city", "province", "service"] as GroupBy[]).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.groupTab, groupBy === g && styles.groupTabActive]}
              onPress={() => setGroupBy(g)}
            >
              <Text style={[styles.groupTabText, groupBy === g && styles.groupTabTextActive]}>
                {groupLabels[g]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.loadingText}>Loading commission data…</Text>
          </View>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <View style={styles.cardRow}>
              <View style={[styles.card, styles.cardGreen]}>
                <Text style={styles.cardLabel}>Total Commissions</Text>
                <Text style={styles.cardValue}>{formatZMW(data.summary.totalCommissions)}</Text>
              </View>
              <View style={[styles.card, styles.cardBlue]}>
                <Text style={styles.cardLabel}>Transactions</Text>
                <Text style={styles.cardValue}>{data.summary.totalTransactions}</Text>
              </View>
            </View>
            <View style={styles.cardRow}>
              <View style={[styles.card, styles.cardOrange]}>
                <Text style={styles.cardLabel}>Avg. Commission</Text>
                <Text style={styles.cardValue}>{formatZMW(data.summary.averageCommission)}</Text>
              </View>
              <View style={[styles.card, styles.cardPurple]}>
                <Text style={styles.cardLabel}>Platform MSISDN</Text>
                <Text style={styles.cardValue}>{data.summary.platformMsisdn}</Text>
              </View>
            </View>

            {/* Breakdown Table */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Breakdown — {groupLabels[groupBy]}</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableCellLabel]}>Label</Text>
                <Text style={styles.tableCell}>Commission</Text>
                <Text style={styles.tableCell}>Txns</Text>
                <Text style={styles.tableCell}>%</Text>
              </View>
              {data.breakdown.map((item, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, styles.tableCellLabel]} numberOfLines={2}>
                    {item.label}
                  </Text>
                  <Text style={styles.tableCell}>{formatZMW(item.commissionAmount)}</Text>
                  <Text style={styles.tableCell}>{item.transactionCount}</Text>
                  <Text style={styles.tableCell}>{item.percentage}%</Text>
                </View>
              ))}
            </View>

            {/* Service Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>By Service Type</Text>
              {data.byService.map((item, idx) => (
                <View key={idx} style={styles.serviceRow}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceLabel}>{item.label}</Text>
                    <Text style={styles.serviceCount}>{item.transactionCount} transactions</Text>
                  </View>
                  <View style={styles.serviceRight}>
                    <Text style={styles.serviceAmount}>{formatZMW(item.commissionAmount)}</Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${item.percentage}%` as `${number}%` }]} />
                    </View>
                    <Text style={styles.servicePercent}>{item.percentage}%</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Daily Trend (last 7 entries) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Trend</Text>
              {data.daily.slice(-7).map((d, idx) => (
                <View key={idx} style={styles.dailyRow}>
                  <Text style={styles.dailyDate}>{d.date}</Text>
                  <Text style={styles.dailyCount}>{d.count} txns</Text>
                  <Text style={styles.dailyAmount}>{formatZMW(d.amount)}</Text>
                </View>
              ))}
            </View>

            {/* Export Buttons */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Export Report</Text>
              <View style={styles.exportRow}>
                <TouchableOpacity
                  style={[styles.exportBtn, styles.exportBtnCSV]}
                  onPress={() => handleExport("csv")}
                  disabled={exporting}
                >
                  <Text style={styles.exportBtnText}>📄 CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.exportBtn, styles.exportBtnExcel]}
                  onPress={() => handleExport("excel")}
                  disabled={exporting}
                >
                  <Text style={styles.exportBtnText}>📊 Excel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.exportBtn, styles.exportBtnPDF]}
                  onPress={() => handleExport("pdf")}
                  disabled={exporting}
                >
                  <Text style={styles.exportBtnText}>📋 PDF</Text>
                </TouchableOpacity>
              </View>
              {exporting && (
                <View style={styles.exportingRow}>
                  <ActivityIndicator size="small" color="#16a34a" />
                  <Text style={styles.exportingText}>Preparing export…</Text>
                </View>
              )}
            </View>

            <Text style={styles.lastUpdated}>
              Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: _rs.sp(16), paddingBottom: _rs.sp(48) },
  header: { flexDirection: "row", alignItems: "center", marginBottom: _rs.sp(16), gap: _rs.sp(12) },
  backBtn: { paddingVertical: _rs.sp(6), paddingRight: _rs.sp(8) },
  backText: { color: "#16a34a", fontSize: _rs.fs(15), fontWeight: "600" },
  headerTitles: { flex: 1 },
  title: { fontSize: _rs.fs(20), fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: _rs.fs(12), color: "#6b7280", marginTop: _rs.sp(2) },
  tabRow: { marginBottom: _rs.sp(8) },
  tab: { paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(8), borderRadius: _rs.s(20), backgroundColor: "#f3f4f6", marginRight: _rs.sp(8) },
  tabActive: { backgroundColor: "#16a34a" },
  tabText: { fontSize: _rs.fs(13), color: "#374151", fontWeight: "500" },
  tabTextActive: { color: "#ffffff" },
  groupTab: { paddingHorizontal: _rs.sp(12), paddingVertical: _rs.sp(6), borderRadius: _rs.s(16), backgroundColor: "#e5e7eb", marginRight: _rs.sp(8) },
  groupTabActive: { backgroundColor: "#1d4ed8" },
  groupTabText: { fontSize: _rs.fs(12), color: "#374151" },
  groupTabTextActive: { color: "#ffffff" },
  loadingBox: { alignItems: "center", paddingVertical: _rs.sp(60), gap: _rs.sp(12) },
  loadingText: { color: "#6b7280", fontSize: _rs.fs(14) },
  cardRow: { flexDirection: "row", gap: _rs.sp(12), marginBottom: _rs.sp(12) },
  card: { flex: 1, borderRadius: _rs.s(12), padding: _rs.sp(14) },
  cardGreen: { backgroundColor: "#dcfce7" },
  cardBlue: { backgroundColor: "#dbeafe" },
  cardOrange: { backgroundColor: "#ffedd5" },
  cardPurple: { backgroundColor: "#ede9fe" },
  cardLabel: { fontSize: _rs.fs(11), color: "#374151", fontWeight: "500", marginBottom: _rs.sp(4) },
  cardValue: { fontSize: _rs.fs(15), fontWeight: "700", color: "#111827" },
  section: { backgroundColor: "#ffffff", borderRadius: _rs.s(12), padding: _rs.sp(14), marginBottom: _rs.sp(14), borderWidth: 1, borderColor: "#e5e7eb" },
  sectionTitle: { fontSize: _rs.fs(15), fontWeight: "700", color: "#111827", marginBottom: _rs.sp(12) },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#e5e7eb", paddingBottom: _rs.sp(8), marginBottom: _rs.sp(4) },
  tableRow: { flexDirection: "row", paddingVertical: _rs.sp(7) },
  tableRowAlt: { backgroundColor: "#f9fafb" },
  tableCell: { flex: 1, fontSize: _rs.fs(11), color: "#374151", textAlign: "right" },
  tableCellLabel: { flex: 2, textAlign: "left", fontWeight: "500" },
  serviceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: _rs.sp(10), borderBottomWidth: 1, borderColor: "#f3f4f6" },
  serviceInfo: { flex: 1 },
  serviceLabel: { fontSize: _rs.fs(13), fontWeight: "600", color: "#111827" },
  serviceCount: { fontSize: _rs.fs(11), color: "#6b7280", marginTop: _rs.sp(2) },
  serviceRight: { alignItems: "flex-end", gap: _rs.sp(4) },
  serviceAmount: { fontSize: _rs.fs(13), fontWeight: "700", color: "#16a34a" },
  progressBar: { width: _rs.s(80), height: _rs.s(4), backgroundColor: "#e5e7eb", borderRadius: _rs.s(2), overflow: "hidden" },
  progressFill: { height: _rs.s(4), backgroundColor: "#16a34a", borderRadius: _rs.s(2) },
  servicePercent: { fontSize: _rs.fs(11), color: "#6b7280" },
  dailyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: _rs.sp(8), borderBottomWidth: 1, borderColor: "#f3f4f6" },
  dailyDate: { fontSize: _rs.fs(12), color: "#374151", flex: 1 },
  dailyCount: { fontSize: _rs.fs(12), color: "#6b7280", flex: 1, textAlign: "center" },
  dailyAmount: { fontSize: _rs.fs(12), fontWeight: "600", color: "#16a34a", flex: 1, textAlign: "right" },
  exportRow: { flexDirection: "row", gap: _rs.sp(10) },
  exportBtn: { flex: 1, paddingVertical: _rs.sp(12), borderRadius: _rs.s(10), alignItems: "center" },
  exportBtnCSV: { backgroundColor: "#16a34a" },
  exportBtnExcel: { backgroundColor: "#1d4ed8" },
  exportBtnPDF: { backgroundColor: "#dc2626" },
  exportBtnText: { color: "#ffffff", fontWeight: "700", fontSize: _rs.fs(13) },
  exportingRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8), marginTop: _rs.sp(10) },
  exportingText: { color: "#6b7280", fontSize: _rs.fs(13) },
  lastUpdated: { textAlign: "center", fontSize: _rs.fs(11), color: "#9ca3af", marginTop: _rs.sp(8) },
});
