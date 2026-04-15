import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import {
  useScheduledReports,
  ScheduledReport,
  GeneratedReport,
  ReportFrequency,
  ReportType,
} from "@/lib/scheduled-reports-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { APP_CONFIG } from "@/constants/app";

export default function AdminScheduledReportsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, hasPermission } = useAdmin();
  const {
    schedules,
    reports,
    addSchedule,
    deleteSchedule,
    toggleSchedule,
    generateReport,
    getReportsBySchedule,
  } = useScheduledReports();

  const [activeTab, setActiveTab] = useState<"schedules" | "history">("schedules");
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<GeneratedReport | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    name: "",
    type: "summary" as ReportType,
    frequency: "weekly" as ReportFrequency,
    recipients: "",
  });

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
    if (!hasPermission("exportData")) {
      Alert.alert("Access Denied", "You don't have permission to manage scheduled reports.");
      router.back();
    }
  }, [isAdminAuthenticated]);

  const handleAddSchedule = async () => {
    if (!newSchedule.name.trim()) {
      Alert.alert("Error", "Please enter a report name");
      return;
    }

    const recipients = newSchedule.recipients
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    await addSchedule({
      name: newSchedule.name,
      type: newSchedule.type,
      frequency: newSchedule.frequency,
      enabled: true,
      recipients,
    });

    setShowAddSchedule(false);
    setNewSchedule({
      name: "",
      type: "summary",
      frequency: "weekly",
      recipients: "",
    });
  };

  const handleDeleteSchedule = (id: string, name: string) => {
    Alert.alert(
      "Delete Schedule",
      `Are you sure you want to delete "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteSchedule(id) },
      ]
    );
  };

  const handleGenerateNow = async (scheduleId: string) => {
    setGenerating(scheduleId);
    const report = await generateReport(scheduleId);
    setGenerating(null);
    if (report) {
      Alert.alert("Success", "Report generated successfully!");
      setSelectedReport(report);
    } else {
      Alert.alert("Error", "Failed to generate report");
    }
  };

  const getTypeIcon = (type: ReportType) => {
    switch (type) {
      case "summary":
        return "assessment";
      case "transactions":
        return "account-balance-wallet";
      case "users":
        return "people";
      case "pickups":
        return "local-shipping";
      case "disputes":
        return "gavel";
      default:
        return "description";
    }
  };

  const getTypeColor = (type: ReportType) => {
    switch (type) {
      case "summary":
        return "#3B82F6";
      case "transactions":
        return "#22C55E";
      case "users":
        return "#8B5CF6";
      case "pickups":
        return "#F59E0B";
      case "disputes":
        return "#EF4444";
      default:
        return "#9BA1A6";
    }
  };

  const getFrequencyLabel = (frequency: ReportFrequency) => {
    switch (frequency) {
      case "daily":
        return "Daily";
      case "weekly":
        return "Weekly";
      case "monthly":
        return "Monthly";
      default:
        return frequency;
    }
  };

  if (!isAdminAuthenticated || !hasPermission("exportData")) {
    return null;
  }

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
              <Text className="text-2xl font-bold text-foreground">Scheduled Reports</Text>
              <Text className="text-muted">Auto-generate periodic reports</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="px-6 mb-4">
          <View className="flex-row bg-surface rounded-xl p-1">
            <TouchableOpacity
              onPress={() => setActiveTab("schedules")}
              className={`flex-1 py-3 rounded-lg ${activeTab === "schedules" ? "bg-primary" : ""}`}
            >
              <Text className={`text-center font-medium ${activeTab === "schedules" ? "text-white" : "text-muted"}`}>
                Schedules ({schedules.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab("history")}
              className={`flex-1 py-3 rounded-lg ${activeTab === "history" ? "bg-primary" : ""}`}
            >
              <Text className={`text-center font-medium ${activeTab === "history" ? "text-white" : "text-muted"}`}>
                History ({reports.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === "schedules" && (
          <View className="px-6">
            {/* Add Button */}
            <TouchableOpacity
              onPress={() => setShowAddSchedule(true)}
              className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4 flex-row items-center justify-center"
            >
              <MaterialIcons name="add" size={24} color="#22C55E" />
              <Text className="text-primary font-semibold ml-2">Create Schedule</Text>
            </TouchableOpacity>

            {/* Schedules List */}
            {schedules.length === 0 ? (
              <View className="bg-surface rounded-xl p-8 border border-border items-center">
                <MaterialIcons name="schedule" size={48} color="#9BA1A6" />
                <Text className="text-foreground font-semibold mt-3">No Schedules</Text>
                <Text className="text-muted text-center mt-1">
                  Create a schedule to auto-generate reports
                </Text>
              </View>
            ) : (
              schedules.map((schedule) => {
                const color = getTypeColor(schedule.type);
                const isGenerating = generating === schedule.id;

                return (
                  <View
                    key={schedule.id}
                    className={`bg-surface rounded-xl p-4 mb-3 border border-border ${
                      !schedule.enabled ? "opacity-50" : ""
                    }`}
                  >
                    <View className="flex-row items-start">
                      <View
                        className="w-12 h-12 rounded-xl items-center justify-center"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <MaterialIcons name={getTypeIcon(schedule.type) as any} size={24} color={color} />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-foreground font-semibold">{schedule.name}</Text>
                        <View className="flex-row items-center mt-1">
                          <View className="bg-primary/10 px-2 py-0.5 rounded mr-2">
                            <Text className="text-primary text-xs capitalize">{schedule.type}</Text>
                          </View>
                          <View className="bg-warning/10 px-2 py-0.5 rounded">
                            <Text className="text-warning text-xs">{getFrequencyLabel(schedule.frequency)}</Text>
                          </View>
                        </View>
                        {schedule.lastGenerated && (
                          <Text className="text-muted text-xs mt-2">
                            Last: {new Date(schedule.lastGenerated).toLocaleDateString()}
                          </Text>
                        )}
                        {schedule.nextScheduled && schedule.enabled && (
                          <Text className="text-muted text-xs">
                            Next: {new Date(schedule.nextScheduled).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                      <View className="items-end">
                        <Switch
                          value={schedule.enabled}
                          onValueChange={() => toggleSchedule(schedule.id)}
                          trackColor={{ false: "#E5E7EB", true: "#22C55E40" }}
                          thumbColor={schedule.enabled ? "#22C55E" : "#9BA1A6"}
                        />
                      </View>
                    </View>

                    {/* Actions */}
                    <View className="flex-row mt-3 pt-3 border-t border-border">
                      <TouchableOpacity
                        onPress={() => handleGenerateNow(schedule.id)}
                        disabled={isGenerating}
                        className="flex-1 flex-row items-center justify-center py-2 mr-2 bg-primary/10 rounded-lg"
                      >
                        {isGenerating ? (
                          <ActivityIndicator size="small" color="#22C55E" />
                        ) : (
                          <>
                            <MaterialIcons name="play-arrow" size={18} color="#22C55E" />
                            <Text className="text-primary font-medium ml-1">Generate Now</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteSchedule(schedule.id, schedule.name)}
                        className="px-4 py-2 bg-error/10 rounded-lg"
                      >
                        <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === "history" && (
          <View className="px-6">
            {reports.length === 0 ? (
              <View className="bg-surface rounded-xl p-8 border border-border items-center">
                <MaterialIcons name="history" size={48} color="#9BA1A6" />
                <Text className="text-foreground font-semibold mt-3">No Reports Yet</Text>
                <Text className="text-muted text-center mt-1">
                  Generated reports will appear here
                </Text>
              </View>
            ) : (
              reports.map((report) => {
                const color = getTypeColor(report.type);

                return (
                  <TouchableOpacity
                    key={report.id}
                    onPress={() => setSelectedReport(report)}
                    className="bg-surface rounded-xl p-4 mb-3 border border-border"
                  >
                    <View className="flex-row items-center">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <MaterialIcons name={getTypeIcon(report.type) as any} size={20} color={color} />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-foreground font-medium">{report.scheduleName}</Text>
                        <Text className="text-muted text-xs">
                          {new Date(report.period.start).toLocaleDateString()} -{" "}
                          {new Date(report.period.end).toLocaleDateString()}
                        </Text>
                      </View>
                      <View className="items-end">
                        <View
                          className={`px-2 py-0.5 rounded ${
                            report.status === "generated" ? "bg-success/10" : "bg-error/10"
                          }`}
                        >
                          <Text
                            className={`text-xs capitalize ${
                              report.status === "generated" ? "text-success" : "text-error"
                            }`}
                          >
                            {report.status}
                          </Text>
                        </View>
                        <Text className="text-muted text-xs mt-1">
                          {new Date(report.generatedAt).toLocaleTimeString()}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Schedule Modal */}
      <Modal visible={showAddSchedule} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">Create Schedule</Text>
              <TouchableOpacity onPress={() => setShowAddSchedule(false)}>
                <MaterialIcons name="close" size={24} color="#9BA1A6" />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-2">Report Name *</Text>
              <TextInput
                value={newSchedule.name}
                onChangeText={(text) => setNewSchedule({ ...newSchedule, name: text })}
                placeholder="Weekly Summary Report"
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholderTextColor="#9BA1A6"
              />
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-2">Report Type</Text>
              <View className="flex-row flex-wrap">
                {(["summary", "transactions", "users", "pickups", "disputes"] as ReportType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setNewSchedule({ ...newSchedule, type })}
                    className={`px-3 py-2 rounded-lg mr-2 mb-2 ${
                      newSchedule.type === type ? "bg-primary" : "bg-surface border border-border"
                    }`}
                  >
                    <Text className={`capitalize ${newSchedule.type === type ? "text-white" : "text-foreground"}`}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-2">Frequency</Text>
              <View className="flex-row">
                {(["daily", "weekly", "monthly"] as ReportFrequency[]).map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    onPress={() => setNewSchedule({ ...newSchedule, frequency: freq })}
                    className={`flex-1 py-3 rounded-lg mr-2 ${
                      newSchedule.frequency === freq ? "bg-primary" : "bg-surface border border-border"
                    }`}
                  >
                    <Text className={`text-center capitalize ${newSchedule.frequency === freq ? "text-white" : "text-foreground"}`}>
                      {freq}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-muted text-sm mb-2">Email Recipients (comma separated)</Text>
              <TextInput
                value={newSchedule.recipients}
                onChangeText={(text) => setNewSchedule({ ...newSchedule, recipients: text })}
                placeholder="admin@ltc.com, manager@ltc.com"
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholderTextColor="#9BA1A6"
              />
            </View>

            <TouchableOpacity
              onPress={handleAddSchedule}
              className="bg-primary py-4 rounded-xl"
            >
              <Text className="text-white text-center font-semibold">Create Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report Detail Modal */}
      <Modal visible={!!selectedReport} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">Report Details</Text>
              <TouchableOpacity onPress={() => setSelectedReport(null)}>
                <MaterialIcons name="close" size={24} color="#9BA1A6" />
              </TouchableOpacity>
            </View>

            {selectedReport && (
              <ScrollView>
                <View className="mb-4">
                  <Text className="text-muted text-sm">Report Name</Text>
                  <Text className="text-foreground font-semibold">{selectedReport.scheduleName}</Text>
                </View>

                <View className="mb-4">
                  <Text className="text-muted text-sm">Period</Text>
                  <Text className="text-foreground">
                    {new Date(selectedReport.period.start).toLocaleDateString()} -{" "}
                    {new Date(selectedReport.period.end).toLocaleDateString()}
                  </Text>
                </View>

                <View className="mb-4">
                  <Text className="text-muted text-sm">Generated</Text>
                  <Text className="text-foreground">
                    {new Date(selectedReport.generatedAt).toLocaleString()}
                  </Text>
                </View>

                <View className="bg-surface rounded-xl p-4 border border-border">
                  <Text className="text-foreground font-semibold mb-3">Statistics</Text>
                  {Object.entries(selectedReport.stats).map(([key, value]) => (
                    <View key={key} className="flex-row justify-between py-2 border-b border-border last:border-0">
                      <Text className="text-muted capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</Text>
                      <Text className="text-foreground font-medium">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
