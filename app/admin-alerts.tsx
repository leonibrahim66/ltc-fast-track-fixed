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
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { useAlerts, AlertRule, Alert as AlertType, AlertSeverity, AlertType as AlertCategory } from "@/lib/alerts-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function AdminAlertsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, adminUser } = useAdmin();
  const {
    rules,
    alerts,
    activeAlerts,
    toggleRule,
    acknowledgeAlert,
    resolveAlert,
    dismissAlert,
    checkAlertConditions,
    addRule,
    deleteRule,
  } = useAlerts();
  const [activeTab, setActiveTab] = useState<"alerts" | "rules">("alerts");
  const [refreshing, setRefreshing] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    type: "dispute" as AlertCategory,
    metric: "pending_disputes",
    operator: "gte" as "gt" | "lt" | "eq" | "gte" | "lte",
    threshold: 5,
    severity: "medium" as AlertSeverity,
  });

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
    // Check conditions on load
    checkAlertConditions();
  }, [isAdminAuthenticated]);

  const onRefresh = async () => {
    setRefreshing(true);
    await checkAlertConditions();
    setRefreshing(false);
  };

  const getSeverityStyle = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return { bg: "bg-red-500/20", color: "#EF4444", icon: "error" };
      case "high":
        return { bg: "bg-orange-500/20", color: "#F97316", icon: "warning" };
      case "medium":
        return { bg: "bg-yellow-500/20", color: "#F59E0B", icon: "info" };
      case "low":
        return { bg: "bg-blue-500/20", color: "#3B82F6", icon: "info-outline" };
      default:
        return { bg: "bg-muted/20", color: "#9BA1A6", icon: "help" };
    }
  };

  const getTypeIcon = (type: AlertCategory) => {
    switch (type) {
      case "dispute":
        return "gavel";
      case "rating":
        return "star";
      case "transaction":
        return "account-balance-wallet";
      case "capacity":
        return "speed";
      case "subscription":
        return "card-membership";
      case "system":
        return "settings";
      default:
        return "notifications";
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    if (adminUser) {
      await acknowledgeAlert(alertId, adminUser.id);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.name.trim()) {
      Alert.alert("Error", "Please enter a rule name");
      return;
    }
    await addRule({
      name: newRule.name,
      type: newRule.type,
      enabled: true,
      condition: {
        metric: newRule.metric,
        operator: newRule.operator,
        threshold: newRule.threshold,
      },
      severity: newRule.severity,
      notifyAdmin: true,
      notifyEmail: false,
    });
    setShowAddRule(false);
    setNewRule({
      name: "",
      type: "dispute",
      metric: "pending_disputes",
      operator: "gte",
      threshold: 5,
      severity: "medium",
    });
  };

  const handleDeleteRule = (ruleId: string, ruleName: string) => {
    Alert.alert(
      "Delete Rule",
      `Are you sure you want to delete "${ruleName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteRule(ruleId),
        },
      ]
    );
  };

  if (!isAdminAuthenticated) {
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
              <Text className="text-2xl font-bold text-foreground">Automated Alerts</Text>
              <Text className="text-muted">Monitor and manage system alerts</Text>
            </View>
            {activeAlerts.length > 0 && (
              <View className="bg-error rounded-full w-8 h-8 items-center justify-center">
                <Text className="text-white font-bold">{activeAlerts.length}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View className="px-6 mb-4">
          <View className="flex-row bg-surface rounded-xl p-1">
            <TouchableOpacity
              onPress={() => setActiveTab("alerts")}
              className={`flex-1 py-3 rounded-lg ${activeTab === "alerts" ? "bg-primary" : ""}`}
            >
              <Text
                className={`text-center font-medium ${
                  activeTab === "alerts" ? "text-white" : "text-muted"
                }`}
              >
                Active Alerts ({activeAlerts.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab("rules")}
              className={`flex-1 py-3 rounded-lg ${activeTab === "rules" ? "bg-primary" : ""}`}
            >
              <Text
                className={`text-center font-medium ${
                  activeTab === "rules" ? "text-white" : "text-muted"
                }`}
              >
                Alert Rules ({rules.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === "alerts" ? (
          <>
            {/* Active Alerts */}
            <View className="px-6">
              {activeAlerts.length === 0 ? (
                <View className="bg-surface rounded-xl p-8 border border-border items-center">
                  <MaterialIcons name="check-circle" size={48} color="#22C55E" />
                  <Text className="text-foreground font-semibold mt-3">All Clear!</Text>
                  <Text className="text-muted text-center mt-1">
                    No active alerts at the moment
                  </Text>
                </View>
              ) : (
                activeAlerts.map((alert) => {
                  const severityStyle = getSeverityStyle(alert.severity);
                  return (
                    <View
                      key={alert.id}
                      className="bg-surface rounded-xl p-4 mb-3 border border-border"
                    >
                      <View className="flex-row items-start mb-3">
                        <View
                          className={`w-10 h-10 rounded-full items-center justify-center ${severityStyle.bg}`}
                        >
                          <MaterialIcons
                            name={severityStyle.icon as any}
                            size={20}
                            color={severityStyle.color}
                          />
                        </View>
                        <View className="flex-1 ml-3">
                          <View className="flex-row items-center">
                            <Text className="text-foreground font-semibold flex-1">
                              {alert.title}
                            </Text>
                            <View
                              className="px-2 py-0.5 rounded"
                              style={{ backgroundColor: `${severityStyle.color}20` }}
                            >
                              <Text
                                className="text-xs font-medium uppercase"
                                style={{ color: severityStyle.color }}
                              >
                                {alert.severity}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-muted text-sm mt-1">{alert.message}</Text>
                          <Text className="text-muted text-xs mt-2">
                            Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      {/* Actions */}
                      <View className="flex-row pt-3 border-t border-border">
                        <TouchableOpacity
                          onPress={() => handleAcknowledge(alert.id)}
                          className="flex-1 flex-row items-center justify-center py-2 mr-2 bg-primary/10 rounded-lg"
                        >
                          <MaterialIcons name="check" size={18} color="#22C55E" />
                          <Text className="text-primary font-medium ml-1">Acknowledge</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => resolveAlert(alert.id)}
                          className="flex-1 flex-row items-center justify-center py-2 mr-2 bg-success/10 rounded-lg"
                        >
                          <MaterialIcons name="done-all" size={18} color="#22C55E" />
                          <Text className="text-success font-medium ml-1">Resolve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => dismissAlert(alert.id)}
                          className="flex-row items-center justify-center py-2 px-3 bg-muted/10 rounded-lg"
                        >
                          <MaterialIcons name="close" size={18} color="#9BA1A6" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Alert History */}
            {alerts.filter((a) => a.status !== "active").length > 0 && (
              <View className="px-6 mt-6">
                <Text className="text-foreground font-semibold mb-3">Alert History</Text>
                {alerts
                  .filter((a) => a.status !== "active")
                  .slice(0, 10)
                  .map((alert) => (
                    <View
                      key={alert.id}
                      className="bg-surface/50 rounded-xl p-3 mb-2 border border-border flex-row items-center"
                    >
                      <MaterialIcons
                        name={getTypeIcon(alert.type) as any}
                        size={20}
                        color="#9BA1A6"
                      />
                      <View className="flex-1 ml-3">
                        <Text className="text-foreground text-sm">{alert.title}</Text>
                        <Text className="text-muted text-xs">
                          {new Date(alert.triggeredAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View
                        className={`px-2 py-0.5 rounded ${
                          alert.status === "resolved"
                            ? "bg-success/20"
                            : alert.status === "acknowledged"
                            ? "bg-warning/20"
                            : "bg-muted/20"
                        }`}
                      >
                        <Text
                          className={`text-xs capitalize ${
                            alert.status === "resolved"
                              ? "text-success"
                              : alert.status === "acknowledged"
                              ? "text-warning"
                              : "text-muted"
                          }`}
                        >
                          {alert.status}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Alert Rules */}
            <View className="px-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-foreground font-semibold">Alert Rules</Text>
                <TouchableOpacity
                  onPress={() => setShowAddRule(true)}
                  className="flex-row items-center bg-primary px-3 py-2 rounded-lg"
                >
                  <MaterialIcons name="add" size={18} color="#fff" />
                  <Text className="text-white font-medium ml-1">Add Rule</Text>
                </TouchableOpacity>
              </View>

              {rules.map((rule) => {
                const severityStyle = getSeverityStyle(rule.severity);
                return (
                  <View
                    key={rule.id}
                    className={`bg-surface rounded-xl p-4 mb-3 border border-border ${
                      !rule.enabled ? "opacity-50" : ""
                    }`}
                  >
                    <View className="flex-row items-start">
                      <View
                        className={`w-10 h-10 rounded-full items-center justify-center ${severityStyle.bg}`}
                      >
                        <MaterialIcons
                          name={getTypeIcon(rule.type) as any}
                          size={20}
                          color={severityStyle.color}
                        />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-foreground font-semibold">{rule.name}</Text>
                        <Text className="text-muted text-sm mt-1">
                          When {rule.condition.metric.replace(/_/g, " ")} is{" "}
                          {rule.condition.operator === "gte"
                            ? "≥"
                            : rule.condition.operator === "lte"
                            ? "≤"
                            : rule.condition.operator === "gt"
                            ? ">"
                            : rule.condition.operator === "lt"
                            ? "<"
                            : "="}{" "}
                          {rule.condition.threshold}
                        </Text>
                        <View className="flex-row items-center mt-2">
                          <View
                            className="px-2 py-0.5 rounded mr-2"
                            style={{ backgroundColor: `${severityStyle.color}20` }}
                          >
                            <Text
                              className="text-xs uppercase"
                              style={{ color: severityStyle.color }}
                            >
                              {rule.severity}
                            </Text>
                          </View>
                          <Text className="text-muted text-xs capitalize">{rule.type}</Text>
                        </View>
                      </View>
                      <View className="items-end">
                        <Switch
                          value={rule.enabled}
                          onValueChange={() => toggleRule(rule.id)}
                          trackColor={{ false: "#E5E7EB", true: "#22C55E40" }}
                          thumbColor={rule.enabled ? "#22C55E" : "#9BA1A6"}
                        />
                        <TouchableOpacity
                          onPress={() => handleDeleteRule(rule.id, rule.name)}
                          className="mt-2"
                        >
                          <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Add Rule Modal */}
      <Modal visible={showAddRule} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">Add Alert Rule</Text>
              <TouchableOpacity onPress={() => setShowAddRule(false)}>
                <MaterialIcons name="close" size={24} color="#9BA1A6" />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-2">Rule Name</Text>
              <TextInput
                value={newRule.name}
                onChangeText={(text) => setNewRule({ ...newRule, name: text })}
                placeholder="e.g., High Dispute Volume"
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholderTextColor="#9BA1A6"
              />
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-2">Alert Type</Text>
              <View className="flex-row flex-wrap">
                {(["dispute", "rating", "transaction", "capacity", "subscription"] as AlertCategory[]).map(
                  (type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setNewRule({ ...newRule, type })}
                      className={`px-3 py-2 rounded-lg mr-2 mb-2 ${
                        newRule.type === type ? "bg-primary" : "bg-surface border border-border"
                      }`}
                    >
                      <Text
                        className={`capitalize ${
                          newRule.type === type ? "text-white" : "text-foreground"
                        }`}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-2">Threshold</Text>
              <TextInput
                value={String(newRule.threshold)}
                onChangeText={(text) =>
                  setNewRule({ ...newRule, threshold: parseInt(text) || 0 })
                }
                keyboardType="numeric"
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholderTextColor="#9BA1A6"
              />
            </View>

            <View className="mb-6">
              <Text className="text-muted text-sm mb-2">Severity</Text>
              <View className="flex-row">
                {(["low", "medium", "high", "critical"] as AlertSeverity[]).map((sev) => {
                  const style = getSeverityStyle(sev);
                  return (
                    <TouchableOpacity
                      key={sev}
                      onPress={() => setNewRule({ ...newRule, severity: sev })}
                      className={`flex-1 py-2 rounded-lg mr-2 ${
                        newRule.severity === sev ? style.bg : "bg-surface border border-border"
                      }`}
                    >
                      <Text
                        className="text-center capitalize text-sm"
                        style={{ color: newRule.severity === sev ? style.color : "#9BA1A6" }}
                      >
                        {sev}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              onPress={handleAddRule}
              className="bg-primary py-4 rounded-xl"
            >
              <Text className="text-white text-center font-semibold">Create Rule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
