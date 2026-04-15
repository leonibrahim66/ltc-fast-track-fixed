import { ScrollView, Text, View, TouchableOpacity, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useRateLimitAlerts } from "@/lib/rate-limit-alerts-context";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function RateLimitAlertsScreen() {
  const router = useRouter();
  const { alerts, acknowledgeAlert, deleteAlert, getUnacknowledgedAlerts } =
    useRateLimitAlerts();
  const [selectedAlertType, setSelectedAlertType] = useState<
    "all" | "unacknowledged"
  >("all");

  const displayAlerts =
    selectedAlertType === "unacknowledged" ? getUnacknowledgedAlerts() : alerts;

  const handleAcknowledge = (alertId: string) => {
    acknowledgeAlert(alertId);
    Alert.alert("Success", "Alert acknowledged");
  };

  const handleDelete = (alertId: string) => {
    deleteAlert(alertId);
    Alert.alert("Success", "Alert deleted");
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-4">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Rate Limit Alerts
            </Text>
            <Text className="text-sm text-muted">
              Manage API key rate limit notifications
            </Text>
          </View>

          {/* Filter Tabs */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setSelectedAlertType("all")}
              className={`flex-1 py-2 px-4 rounded-lg ${
                selectedAlertType === "all"
                  ? "bg-primary"
                  : "bg-surface border border-border"
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  selectedAlertType === "all"
                    ? "text-background"
                    : "text-foreground"
                }`}
              >
                All ({alerts.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedAlertType("unacknowledged")}
              className={`flex-1 py-2 px-4 rounded-lg ${
                selectedAlertType === "unacknowledged"
                  ? "bg-error"
                  : "bg-surface border border-border"
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  selectedAlertType === "unacknowledged"
                    ? "text-background"
                    : "text-foreground"
                }`}
              >
                Unacknowledged ({getUnacknowledgedAlerts().length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Alerts List */}
          {displayAlerts.length === 0 ? (
            <View className="items-center justify-center py-8">
              <Text className="text-muted">No alerts</Text>
            </View>
          ) : (
            displayAlerts.map((alert) => (
              <View
                key={alert.id}
                className={`p-4 rounded-lg border ${
                  alert.acknowledged
                    ? "bg-surface border-border"
                    : "bg-error/10 border-error"
                }`}
              >
                <View className="gap-2">
                  {/* Alert Header */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-foreground">
                        {alert.apiKeyName}
                      </Text>
                      <Text className="text-xs text-muted">{alert.apiKeyId}</Text>
                    </View>
                    <View
                      className={`px-3 py-1 rounded-full ${
                        alert.acknowledged
                          ? "bg-success/20"
                          : "bg-error/20"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          alert.acknowledged
                            ? "text-success"
                            : "text-error"
                        }`}
                      >
                        {alert.acknowledged ? "Acknowledged" : "Pending"}
                      </Text>
                    </View>
                  </View>

                  {/* Usage Stats */}
                  <View className="gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted">Usage</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {alert.currentUsage}% of limit
                      </Text>
                    </View>
                    <View className="h-2 bg-surface rounded-full overflow-hidden">
                      <View
                        className="h-full bg-error"
                        style={{ width: `${Math.min(alert.currentUsage, 100)}%` }}
                      />
                    </View>
                  </View>

                  {/* Details */}
                  <View className="gap-1">
                    <Text className="text-xs text-muted">
                      Limit: {alert.limit} requests per {alert.period}
                    </Text>
                    <Text className="text-xs text-muted">
                      Alert Type: {alert.alertType}
                    </Text>
                    <Text className="text-xs text-muted">
                      Sent: {new Date(alert.sentAt || alert.createdAt).toLocaleString()}
                    </Text>
                  </View>

                  {/* Actions */}
                  {!alert.acknowledged && (
                    <View className="flex-row gap-2 mt-2">
                      <TouchableOpacity
                        onPress={() => handleAcknowledge(alert.id)}
                        className="flex-1 py-2 px-3 bg-success rounded-lg"
                      >
                        <Text className="text-center text-sm font-semibold text-background">
                          Acknowledge
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(alert.id)}
                        className="flex-1 py-2 px-3 bg-error rounded-lg"
                      >
                        <Text className="text-center text-sm font-semibold text-background">
                          Dismiss
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
