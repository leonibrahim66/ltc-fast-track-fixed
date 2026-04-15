import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import {
  useActivityLogs,
  ActivityLog,
  ActivityType,
  getActivityTypeLabel,
  getActivityTypeIcon,
  getActivityTypeColor,
} from "@/lib/activity-logs-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type FilterType = "all" | ActivityType;

export default function AdminActivityLogsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, hasPermission } = useAdmin();
  const { logs, getLogs, clearOldLogs } = useActivityLogs();
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
    if (!hasPermission("settings")) {
      Alert.alert("Access Denied", "You don't have permission to view activity logs.");
      router.back();
    }
  }, [isAdminAuthenticated]);

  useEffect(() => {
    applyFilter();
  }, [logs, filterType]);

  const applyFilter = () => {
    if (filterType === "all") {
      setFilteredLogs(getLogs({ limit: 100 }));
    } else {
      setFilteredLogs(getLogs({ type: filterType, limit: 100 }));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    applyFilter();
    setRefreshing(false);
  };

  const handleClearOldLogs = () => {
    Alert.alert(
      "Clear Old Logs",
      "This will remove logs older than 30 days. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearOldLogs(30);
            Alert.alert("Success", "Old logs have been cleared.");
          },
        },
      ]
    );
  };

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "login", label: "Logins" },
    { value: "export", label: "Exports" },
    { value: "user_suspend", label: "Suspensions" },
    { value: "dispute_resolve", label: "Disputes" },
    { value: "payment_approve", label: "Payments" },
    { value: "settings_change", label: "Settings" },
  ];

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isAdminAuthenticated || !hasPermission("settings")) {
    return null;
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
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
              <Text className="text-2xl font-bold text-foreground">Activity Logs</Text>
              <Text className="text-muted">Admin action history</Text>
            </View>
            <TouchableOpacity
              onPress={handleClearOldLogs}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
            >
              <MaterialIcons name="delete-sweep" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View className="px-6 mb-4">
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row">
              <View className="flex-1 items-center">
                <Text className="text-2xl font-bold text-foreground">{logs.length}</Text>
                <Text className="text-muted text-xs">Total Logs</Text>
              </View>
              <View className="flex-1 items-center border-l border-border">
                <Text className="text-2xl font-bold text-success">
                  {logs.filter((l) => l.type === "login").length}
                </Text>
                <Text className="text-muted text-xs">Logins</Text>
              </View>
              <View className="flex-1 items-center border-l border-border">
                <Text className="text-2xl font-bold text-primary">
                  {logs.filter((l) => l.type === "export").length}
                </Text>
                <Text className="text-muted text-xs">Exports</Text>
              </View>
              <View className="flex-1 items-center border-l border-border">
                <Text className="text-2xl font-bold text-warning">
                  {logs.filter((l) => l.type.includes("dispute")).length}
                </Text>
                <Text className="text-muted text-xs">Disputes</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Filters */}
        <View className="px-6 mb-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row">
              {filterOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setFilterType(option.value)}
                  className={`px-4 py-2 rounded-full mr-2 ${
                    filterType === option.value
                      ? "bg-primary"
                      : "bg-surface border border-border"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      filterType === option.value ? "text-white font-medium" : "text-foreground"
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Logs List */}
        <View className="px-6">
          {filteredLogs.length === 0 ? (
            <View className="bg-surface rounded-xl p-8 border border-border items-center">
              <MaterialIcons name="history" size={48} color="#9BA1A6" />
              <Text className="text-foreground font-semibold mt-3">No Activity Logs</Text>
              <Text className="text-muted text-center mt-1">
                Admin actions will be recorded here
              </Text>
            </View>
          ) : (
            filteredLogs.map((log, index) => {
              const color = getActivityTypeColor(log.type);
              const icon = getActivityTypeIcon(log.type);
              const label = getActivityTypeLabel(log.type);

              return (
                <View
                  key={log.id}
                  className="bg-surface rounded-xl p-4 mb-3 border border-border"
                >
                  <View className="flex-row items-start">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <MaterialIcons name={icon as any} size={20} color={color} />
                    </View>
                    <View className="flex-1 ml-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-foreground font-semibold">{log.action}</Text>
                        <Text className="text-muted text-xs">{formatTimestamp(log.timestamp)}</Text>
                      </View>
                      <Text className="text-muted text-sm mt-1">{log.description}</Text>
                      <View className="flex-row items-center mt-2">
                        <View
                          className="px-2 py-0.5 rounded mr-2"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          <Text className="text-xs" style={{ color }}>
                            {label}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <MaterialIcons name="person" size={12} color="#9BA1A6" />
                          <Text className="text-muted text-xs ml-1">{log.adminName}</Text>
                        </View>
                        <View className="flex-row items-center ml-2">
                          <MaterialIcons name="badge" size={12} color="#9BA1A6" />
                          <Text className="text-muted text-xs ml-1 capitalize">{log.adminRole}</Text>
                        </View>
                      </View>
                      {log.targetId && (
                        <View className="mt-2 bg-background rounded-lg px-3 py-2">
                          <Text className="text-muted text-xs">
                            Target: {log.targetType} #{log.targetId.slice(-8)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Load More */}
        {filteredLogs.length >= 100 && (
          <View className="px-6 mt-4">
            <View className="bg-surface/50 rounded-xl p-4 border border-border items-center">
              <Text className="text-muted text-sm">
                Showing last 100 logs. Clear old logs to see more recent activity.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
