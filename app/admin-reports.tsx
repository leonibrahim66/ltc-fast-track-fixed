import {useEffect, useState, useCallback} from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import {useRouter, useFocusEffect} from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { usePickups } from "@/lib/pickups-context";
import { usePayments } from "@/lib/payments-context";
import { useDisputes } from "@/lib/disputes-context";
import {
  exportToCSV,
  TRANSACTION_COLUMNS,
  USER_COLUMNS,
  PICKUP_COLUMNS,
  DISPUTE_COLUMNS,
  SUBSCRIPTION_COLUMNS,
  generateSummaryReport,
} from "@/lib/export-utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  dataKey: string;
}

export default function AdminReportsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, hasPermission, stats, refreshStats } = useAdmin();
  const { pickups } = usePickups();
  const { payments } = usePayments();
  const { disputes } = useDisputes();
  const [exporting, setExporting] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
    if (!hasPermission("exportData")) {
      Alert.alert("Access Denied", "You don't have permission to export data.");
      router.back();
      return;
    }
    loadUsers();
    refreshStats();
  }, [isAdminAuthenticated]);

  const loadUsers = async () => {
    try {
      const usersDb = await AsyncStorage.getItem("@ltc_users_db");
      if (usersDb) {
        const parsed = JSON.parse(usersDb);
        setUsers(Object.values(parsed));
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const reportTypes: ReportType[] = [
    {
      id: "transactions",
      title: "Transactions Report",
      description: "Export all payment transactions",
      icon: "account-balance-wallet",
      color: "#22C55E",
      dataKey: "transactions",
    },
    {
      id: "users",
      title: "Users Report",
      description: "Export all registered users",
      icon: "people",
      color: "#3B82F6",
      dataKey: "users",
    },
    {
      id: "pickups",
      title: "Pickups Report",
      description: "Export all pickup records",
      icon: "local-shipping",
      color: "#F59E0B",
      dataKey: "pickups",
    },
    {
      id: "disputes",
      title: "Disputes Report",
      description: "Export all customer disputes",
      icon: "gavel",
      color: "#EF4444",
      dataKey: "disputes",
    },
    {
      id: "subscriptions",
      title: "Subscriptions Report",
      description: "Export subscription data",
      icon: "card-membership",
      color: "#8B5CF6",
      dataKey: "subscriptions",
    },
    {
      id: "summary",
      title: "Summary Report",
      description: "Generate overall statistics report",
      icon: "assessment",
      color: "#06B6D4",
      dataKey: "summary",
    },
  ];

  const handleExport = async (reportType: ReportType) => {
    setExporting(reportType.id);

    try {
      let result;

      switch (reportType.dataKey) {
        case "transactions":
          result = await exportToCSV(payments, TRANSACTION_COLUMNS, "ltc_transactions");
          break;
        case "users":
          result = await exportToCSV(users, USER_COLUMNS, "ltc_users");
          break;
        case "pickups":
          result = await exportToCSV(pickups, PICKUP_COLUMNS, "ltc_pickups");
          break;
        case "disputes":
          result = await exportToCSV(disputes, DISPUTE_COLUMNS, "ltc_disputes");
          break;
        case "subscriptions":
          const subscribers = users.filter((u) => u.subscriptionPlan);
          result = await exportToCSV(subscribers, SUBSCRIPTION_COLUMNS, "ltc_subscriptions");
          break;
        case "summary":
          const summaryText = generateSummaryReport(stats);
          if (Platform.OS === "web") {
            const blob = new Blob([summaryText], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `ltc_summary_${new Date().toISOString().split("T")[0]}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            result = { success: true, message: "Summary report downloaded" };
          } else {
            Alert.alert("Summary Report", summaryText);
            result = { success: true, message: "Summary displayed" };
          }
          break;
        default:
          result = { success: false, message: "Unknown report type" };
      }

      if (result.success) {
        Alert.alert("Export Successful", result.message);
      } else {
        Alert.alert("Export Failed", result.message);
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Export Failed", "An error occurred while exporting data.");
    } finally {
      setExporting(null);
    }
  };

  const getDataCount = (dataKey: string): number => {
    switch (dataKey) {
      case "transactions":
        return payments.length;
      case "users":
        return users.length;
      case "pickups":
        return pickups.length;
      case "disputes":
        return disputes.length;
      case "subscriptions":
        return users.filter((u) => u.subscriptionPlan).length;
      case "summary":
        return 1;
      default:
        return 0;
    }
  };

  if (!isAdminAuthenticated || !hasPermission("exportData")) {
    return null;
  }
  // Real-time: reload data every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );


  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
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
              <Text className="text-2xl font-bold text-foreground">Export Reports</Text>
              <Text className="text-muted">Download data as CSV files</Text>
            </View>
          </View>
        </View>

        {/* Info Card */}
        <View className="px-6 mb-6">
          <View className="bg-primary/10 rounded-xl p-4 border border-primary/20">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="info" size={20} color="#22C55E" />
              <Text className="text-foreground font-semibold ml-2">Export Information</Text>
            </View>
            <Text className="text-muted text-sm">
              All reports are exported as CSV files which can be opened in Excel, Google Sheets, 
              or any spreadsheet application. Data is exported based on current filters and date range.
            </Text>
          </View>
        </View>

        {/* Report Types */}
        <View className="px-6">
          <Text className="text-foreground font-semibold mb-3">Available Reports</Text>
          {reportTypes.map((report) => {
            const count = getDataCount(report.dataKey);
            const isExporting = exporting === report.id;

            return (
              <TouchableOpacity
                key={report.id}
                onPress={() => handleExport(report)}
                disabled={isExporting || count === 0}
                className={`bg-surface rounded-xl p-4 mb-3 border border-border ${
                  count === 0 ? "opacity-50" : ""
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center"
                    style={{ backgroundColor: `${report.color}15` }}
                  >
                    {isExporting ? (
                      <ActivityIndicator size="small" color={report.color} />
                    ) : (
                      <MaterialIcons name={report.icon as any} size={24} color={report.color} />
                    )}
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium">{report.title}</Text>
                    <Text className="text-muted text-sm">{report.description}</Text>
                  </View>
                  <View className="items-end">
                    <View className="bg-background px-3 py-1 rounded-full border border-border">
                      <Text className="text-foreground font-semibold">{count}</Text>
                    </View>
                    <Text className="text-xs text-muted mt-1">records</Text>
                  </View>
                </View>

                {/* Export Button */}
                <View className="mt-3 pt-3 border-t border-border flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <MaterialIcons name="file-download" size={16} color="#9BA1A6" />
                    <Text className="text-muted text-sm ml-1">
                      {report.dataKey === "summary" ? "TXT" : "CSV"} Format
                    </Text>
                  </View>
                  <View
                    className="px-4 py-2 rounded-lg"
                    style={{ backgroundColor: isExporting ? "#9BA1A620" : `${report.color}20` }}
                  >
                    <Text
                      className="font-medium"
                      style={{ color: isExporting ? "#9BA1A6" : report.color }}
                    >
                      {isExporting ? "Exporting..." : "Export"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quick Stats */}
        <View className="px-6 mt-4">
          <Text className="text-foreground font-semibold mb-3">Data Overview</Text>
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row flex-wrap">
              <View className="w-1/2 p-2">
                <Text className="text-muted text-xs">Total Users</Text>
                <Text className="text-xl font-bold text-foreground">{users.length}</Text>
              </View>
              <View className="w-1/2 p-2">
                <Text className="text-muted text-xs">Total Pickups</Text>
                <Text className="text-xl font-bold text-foreground">{pickups.length}</Text>
              </View>
              <View className="w-1/2 p-2">
                <Text className="text-muted text-xs">Total Transactions</Text>
                <Text className="text-xl font-bold text-foreground">{payments.length}</Text>
              </View>
              <View className="w-1/2 p-2">
                <Text className="text-muted text-xs">Total Disputes</Text>
                <Text className="text-xl font-bold text-foreground">{disputes.length}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Export History Note */}
        <View className="px-6 mt-4">
          <View className="bg-surface/50 rounded-xl p-4 border border-border">
            <View className="flex-row items-center">
              <MaterialIcons name="history" size={20} color="#9BA1A6" />
              <Text className="text-muted text-sm ml-2">
                Exported files are saved to your device&apos;s downloads folder.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
