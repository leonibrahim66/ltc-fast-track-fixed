import { ScrollView, Text, View, TouchableOpacity, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useWebhookRetry } from "@/lib/webhook-retry-context";
import { useState } from "react";

export default function WebhookRetryDashboard() {
  const {
    deliveries,
    retryDelivery,
    markAsDelivered,
    getFailedDeliveries,
    getRetryingDeliveries,
    getSuccessRate,
  } = useWebhookRetry();
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "failed" | "retrying" | "delivered"
  >("all");

  const displayDeliveries = deliveries.filter((d) => {
    if (selectedStatus === "all") return true;
    return d.status === selectedStatus;
  });

  const handleRetry = (deliveryId: string) => {
    retryDelivery(deliveryId);
    Alert.alert("Success", "Webhook retry initiated");
  };

  const handleMarkDelivered = (deliveryId: string) => {
    markAsDelivered(deliveryId);
    Alert.alert("Success", "Marked as delivered");
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-4">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Webhook Retry Dashboard
            </Text>
            <Text className="text-sm text-muted">
              Manage failed webhook deliveries
            </Text>
          </View>

          {/* Stats */}
          <View className="grid grid-cols-2 gap-3">
            <View className="bg-surface rounded-lg p-4">
              <Text className="text-xs text-muted mb-1">Success Rate</Text>
              <Text className="text-2xl font-bold text-success">{getSuccessRate()}%</Text>
            </View>
            <View className="bg-surface rounded-lg p-4">
              <Text className="text-xs text-muted mb-1">Total Deliveries</Text>
              <Text className="text-2xl font-bold text-foreground">{deliveries.length}</Text>
            </View>
            <View className="bg-surface rounded-lg p-4">
              <Text className="text-xs text-muted mb-1">Failed</Text>
              <Text className="text-2xl font-bold text-error">
                {getFailedDeliveries().length}
              </Text>
            </View>
            <View className="bg-surface rounded-lg p-4">
              <Text className="text-xs text-muted mb-1">Retrying</Text>
              <Text className="text-2xl font-bold text-warning">
                {getRetryingDeliveries().length}
              </Text>
            </View>
          </View>

          {/* Filter Tabs */}
          <View className="flex-row gap-2">
            {(["all", "failed", "retrying", "delivered"] as const).map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => setSelectedStatus(status)}
                className={`flex-1 py-2 px-3 rounded-lg ${
                  selectedStatus === status
                    ? "bg-primary"
                    : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`text-center text-xs font-semibold ${
                    selectedStatus === status
                      ? "text-background"
                      : "text-foreground"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Deliveries List */}
          {displayDeliveries.length === 0 ? (
            <View className="items-center justify-center py-8">
              <Text className="text-muted">No deliveries found</Text>
            </View>
          ) : (
            displayDeliveries.map((delivery) => (
              <View
                key={delivery.id}
                className={`p-4 rounded-lg border ${
                  delivery.status === "failed"
                    ? "bg-error/10 border-error"
                    : delivery.status === "retrying"
                      ? "bg-warning/10 border-warning"
                      : "bg-success/10 border-success"
                }`}
              >
                <View className="gap-2">
                  {/* Header */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">
                        {delivery.eventType}
                      </Text>
                      <Text className="text-xs text-muted">{delivery.webhookId}</Text>
                    </View>
                    <View
                      className={`px-2 py-1 rounded ${
                        delivery.status === "failed"
                          ? "bg-error/20"
                          : delivery.status === "retrying"
                            ? "bg-warning/20"
                            : "bg-success/20"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          delivery.status === "failed"
                            ? "text-error"
                            : delivery.status === "retrying"
                              ? "text-warning"
                              : "text-success"
                        }`}
                      >
                        {delivery.status.charAt(0).toUpperCase() +
                          delivery.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  {/* Details */}
                  <View className="gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-muted">Attempts</Text>
                      <Text className="text-xs font-semibold text-foreground">
                        {delivery.attemptCount}/{delivery.maxAttempts}
                      </Text>
                    </View>
                    {delivery.statusCode && (
                      <Text className="text-xs text-muted">
                        Status Code: {delivery.statusCode}
                      </Text>
                    )}
                    {delivery.error && (
                      <Text className="text-xs text-error">{delivery.error}</Text>
                    )}
                    <Text className="text-xs text-muted">
                      Last Attempt:{" "}
                      {new Date(delivery.lastAttemptAt).toLocaleString()}
                    </Text>
                    {delivery.nextRetryAt && (
                      <Text className="text-xs text-muted">
                        Next Retry:{" "}
                        {new Date(delivery.nextRetryAt).toLocaleString()}
                      </Text>
                    )}
                  </View>

                  {/* Payload Preview */}
                  <View className="bg-background/50 rounded p-2">
                    <Text className="text-xs text-muted font-mono">
                      {delivery.payload.substring(0, 100)}
                      {delivery.payload.length > 100 ? "..." : ""}
                    </Text>
                  </View>

                  {/* Actions */}
                  {delivery.status !== "delivered" && (
                    <View className="flex-row gap-2 mt-2">
                      <TouchableOpacity
                        onPress={() => handleRetry(delivery.id)}
                        className="flex-1 py-2 px-3 bg-primary rounded-lg"
                      >
                        <Text className="text-center text-xs font-semibold text-background">
                          Retry Now
                        </Text>
                      </TouchableOpacity>
                      {delivery.status === "failed" && (
                        <TouchableOpacity
                          onPress={() => handleMarkDelivered(delivery.id)}
                          className="flex-1 py-2 px-3 bg-success rounded-lg"
                        >
                          <Text className="text-center text-xs font-semibold text-background">
                            Mark Delivered
                          </Text>
                        </TouchableOpacity>
                      )}
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
