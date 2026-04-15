import { ScrollView, Text, View, TouchableOpacity, Dimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAPIMonitoring } from "@/lib/api-monitoring-context";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";

export default function APIMonitoringScreen() {
  const colors = useColors();
  const {
    metrics,
    getMetricsForPeriod,
    getAverageResponseTime,
    getErrorRate,
    getTotalRequests,
    getEndpointMetrics,
  } = useAPIMonitoring();
  const [timePeriod, setTimePeriod] = useState<1 | 6 | 24>(24);

  const periodMetrics = getMetricsForPeriod(timePeriod);
  const avgResponseTime = getAverageResponseTime();
  const errorRate = getErrorRate();
  const totalRequests = getTotalRequests();
  const endpointMetrics = getEndpointMetrics();

  const maxRequestCount = Math.max(...periodMetrics.map((m) => m.requestCount), 1);
  const maxResponseTime = Math.max(...periodMetrics.map((m) => m.responseTime), 1);

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">API Monitoring</Text>
            <Text className="text-sm text-muted">Real-time API performance metrics</Text>
          </View>

          {/* Time Period Selector */}
          <View className="flex-row gap-2">
            {([1, 6, 24] as const).map((period) => (
              <TouchableOpacity
                key={period}
                onPress={() => setTimePeriod(period)}
                className={`flex-1 py-2 px-3 rounded-lg ${
                  timePeriod === period ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    timePeriod === period ? "text-background" : "text-foreground"
                  }`}
                >
                  {period}h
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Key Metrics */}
          <View className="gap-3">
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Total Requests</Text>
              <Text className="text-3xl font-bold text-primary">{totalRequests.toLocaleString()}</Text>
              <Text className="text-xs text-muted mt-2">
                Last {timePeriod} hours
              </Text>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Avg Response Time</Text>
                <Text className="text-2xl font-bold text-foreground">{avgResponseTime}ms</Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Error Rate</Text>
                <Text className={`text-2xl font-bold ${errorRate > 2 ? "text-error" : "text-success"}`}>
                  {errorRate}%
                </Text>
              </View>
            </View>
          </View>

          {/* Request Volume Chart */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-sm font-semibold text-foreground mb-3">Request Volume</Text>
            <View className="h-32 flex-row items-flex-end gap-1 justify-center">
              {periodMetrics.map((metric, idx) => (
                <View
                  key={idx}
                  className="flex-1 bg-primary rounded-t"
                  style={{
                    height: `${(metric.requestCount / maxRequestCount) * 100}%`,
                    minHeight: 4,
                  }}
                />
              ))}
            </View>
            <Text className="text-xs text-muted text-center mt-2">
              {periodMetrics.length} data points
            </Text>
          </View>

          {/* Response Time Chart */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-sm font-semibold text-foreground mb-3">Response Time (ms)</Text>
            <View className="h-32 flex-row items-flex-end gap-1 justify-center">
              {periodMetrics.map((metric, idx) => (
                <View
                  key={idx}
                  className="flex-1 bg-warning rounded-t"
                  style={{
                    height: `${(metric.responseTime / maxResponseTime) * 100}%`,
                    minHeight: 4,
                  }}
                />
              ))}
            </View>
            <Text className="text-xs text-muted text-center mt-2">
              Last {timePeriod} hours
            </Text>
          </View>

          {/* Top Endpoints */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Top Endpoints</Text>
            {endpointMetrics.slice(0, 5).map((endpoint, idx) => (
              <View key={idx} className="bg-surface rounded-xl p-3 border border-border">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="font-semibold text-foreground text-sm">
                    {endpoint.method} {endpoint.endpoint}
                  </Text>
                  <Text className="text-xs font-bold text-primary">
                    {endpoint.totalRequests.toLocaleString()}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted">
                    Avg: {endpoint.avgResponseTime}ms
                  </Text>
                  <Text className={`text-xs font-semibold ${endpoint.errorRate > 1 ? "text-error" : "text-success"}`}>
                    Error: {endpoint.errorRate}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
