import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAPIMonitoring } from "@/lib/api-monitoring-context";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";

export default function APIUsageAnalyticsScreen() {
  const colors = useColors();
  const { getEndpointMetrics } = useAPIMonitoring();
  const [sortBy, setSortBy] = useState<"requests" | "errors" | "response-time">("requests");

  const endpointMetrics = getEndpointMetrics();

  const sortedMetrics = [...endpointMetrics].sort((a, b) => {
    switch (sortBy) {
      case "requests":
        return b.totalRequests - a.totalRequests;
      case "errors":
        return b.errorRate - a.errorRate;
      case "response-time":
        return b.avgResponseTime - a.avgResponseTime;
      default:
        return 0;
    }
  });

  const totalRequests = endpointMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
  const avgErrorRate =
    endpointMetrics.reduce((sum, m) => sum + m.errorRate, 0) / endpointMetrics.length;

  // Generate hourly traffic pattern (deterministic bell curve peaking at business hours)
  const hourlyTraffic = Array.from({ length: 24 }, (_, i) => {
    // Simulate typical API traffic: low at night, peaks at 9am and 2pm
    const morningPeak = Math.max(0, 400 - Math.abs(i - 9) * 50);
    const afternoonPeak = Math.max(0, 350 - Math.abs(i - 14) * 45);
    const baseLoad = 100;
    return { hour: i, requests: Math.floor(baseLoad + morningPeak + afternoonPeak) };
  });

  const maxHourlyRequests = Math.max(...hourlyTraffic.map((h) => h.requests));

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">API Usage Analytics</Text>
            <Text className="text-sm text-muted">Detailed endpoint and integration metrics</Text>
          </View>

          {/* Overview Stats */}
          <View className="gap-3">
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Total API Requests</Text>
              <Text className="text-3xl font-bold text-primary">
                {totalRequests.toLocaleString()}
              </Text>
              <Text className="text-xs text-muted mt-2">All time</Text>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Avg Error Rate</Text>
                <Text className={`text-2xl font-bold ${avgErrorRate > 2 ? "text-error" : "text-success"}`}>
                  {avgErrorRate.toFixed(2)}%
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Active Endpoints</Text>
                <Text className="text-2xl font-bold text-primary">{endpointMetrics.length}</Text>
              </View>
            </View>
          </View>

          {/* Hourly Traffic Pattern */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-sm font-semibold text-foreground mb-3">24-Hour Traffic Pattern</Text>
            <View className="h-32 flex-row items-flex-end gap-0.5 justify-center">
              {hourlyTraffic.map((data, idx) => (
                <View
                  key={idx}
                  className="flex-1 bg-primary rounded-t"
                  style={{
                    height: `${(data.requests / maxHourlyRequests) * 100}%`,
                    minHeight: 2,
                  }}
                />
              ))}
            </View>
            <View className="flex-row justify-between mt-2">
              <Text className="text-xs text-muted">00:00</Text>
              <Text className="text-xs text-muted">12:00</Text>
              <Text className="text-xs text-muted">23:00</Text>
            </View>
          </View>

          {/* Sort Options */}
          <View className="flex-row gap-2">
            {(["requests", "errors", "response-time"] as const).map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setSortBy(option)}
                className={`flex-1 py-2 px-3 rounded-lg ${
                  sortBy === option ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`text-center font-semibold text-xs ${
                    sortBy === option ? "text-background" : "text-foreground"
                  }`}
                >
                  {option === "requests"
                    ? "By Requests"
                    : option === "errors"
                      ? "By Errors"
                      : "By Speed"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Endpoint Usage Details */}
          <View className="gap-2">
            <Text className="font-semibold text-foreground">Endpoint Usage Breakdown</Text>
            {sortedMetrics.map((endpoint, idx) => {
              const requestPercentage = (endpoint.totalRequests / totalRequests) * 100;
              return (
                <View key={idx} className="bg-surface rounded-xl p-3 border border-border">
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground text-sm">
                        {endpoint.method} {endpoint.endpoint}
                      </Text>
                      <Text className="text-xs text-muted mt-1">
                        {endpoint.totalRequests.toLocaleString()} requests ({requestPercentage.toFixed(1)}%)
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View className="h-2 bg-muted/20 rounded-full mb-2 overflow-hidden">
                    <View
                      className="h-full bg-primary"
                      style={{ width: `${requestPercentage}%` }}
                    />
                  </View>

                  {/* Metrics */}
                  <View className="flex-row justify-between items-center gap-2">
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Response Time</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {endpoint.avgResponseTime}ms
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Error Rate</Text>
                      <Text
                        className={`text-sm font-semibold ${
                          endpoint.errorRate > 1 ? "text-error" : "text-success"
                        }`}
                      >
                        {endpoint.errorRate}%
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Last Used</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {Math.floor((Date.now() - endpoint.lastUsed) / 60000)}m ago
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Top Integration */}
          <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
            <Text className="text-sm font-semibold text-foreground mb-2">Top Integration</Text>
            <Text className="text-lg font-bold text-primary">
              {sortedMetrics[0]?.method} {sortedMetrics[0]?.endpoint}
            </Text>
            <Text className="text-xs text-muted mt-1">
              {sortedMetrics[0]?.totalRequests.toLocaleString()} requests
              {" • "}
              {((sortedMetrics[0]?.totalRequests || 0) / totalRequests * 100).toFixed(1)}% of total
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
