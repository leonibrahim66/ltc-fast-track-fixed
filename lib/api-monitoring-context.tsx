import React, { createContext, useContext, useState, useCallback } from "react";

export interface APIMetric {
  timestamp: number;
  requestCount: number;
  responseTime: number;
  errorCount: number;
  successCount: number;
}

export interface EndpointMetric {
  endpoint: string;
  method: string;
  totalRequests: number;
  avgResponseTime: number;
  errorRate: number;
  lastUsed: number;
}

export interface APIMonitoringContextType {
  metrics: APIMetric[];
  endpointMetrics: EndpointMetric[];
  addMetric: (metric: APIMetric) => void;
  getMetricsForPeriod: (hours: number) => APIMetric[];
  getEndpointMetrics: () => EndpointMetric[];
  getAverageResponseTime: () => number;
  getErrorRate: () => number;
  getTotalRequests: () => number;
}

const APIMonitoringContext = createContext<APIMonitoringContextType | undefined>(
  undefined
);

export function APIMonitoringProvider({ children }: { children: React.ReactNode }) {
  const [metrics, setMetrics] = useState<APIMetric[]>([
    {
      timestamp: Date.now() - 3600000,
      requestCount: 245,
      responseTime: 125,
      errorCount: 3,
      successCount: 242,
    },
    {
      timestamp: Date.now() - 1800000,
      requestCount: 312,
      responseTime: 118,
      errorCount: 2,
      successCount: 310,
    },
    {
      timestamp: Date.now(),
      requestCount: 289,
      responseTime: 132,
      errorCount: 4,
      successCount: 285,
    },
  ]);

  const [endpointMetrics] = useState<EndpointMetric[]>([
    {
      endpoint: "/api/pickups",
      method: "GET",
      totalRequests: 1245,
      avgResponseTime: 120,
      errorRate: 0.8,
      lastUsed: Date.now(),
    },
    {
      endpoint: "/api/pickups",
      method: "POST",
      totalRequests: 456,
      avgResponseTime: 145,
      errorRate: 1.2,
      lastUsed: Date.now() - 300000,
    },
    {
      endpoint: "/api/payments",
      method: "POST",
      totalRequests: 892,
      avgResponseTime: 185,
      errorRate: 0.5,
      lastUsed: Date.now() - 60000,
    },
    {
      endpoint: "/api/users",
      method: "GET",
      totalRequests: 2134,
      avgResponseTime: 95,
      errorRate: 0.3,
      lastUsed: Date.now(),
    },
    {
      endpoint: "/api/disputes",
      method: "POST",
      totalRequests: 234,
      avgResponseTime: 156,
      errorRate: 2.1,
      lastUsed: Date.now() - 1200000,
    },
  ]);

  const addMetric = useCallback((metric: APIMetric) => {
    setMetrics((prev) => {
      const updated = [...prev, metric];
      // Keep only last 24 hours of data
      return updated.slice(-288); // 288 = 24 hours * 60 minutes / 5 minute intervals
    });
  }, []);

  const getMetricsForPeriod = useCallback(
    (hours: number) => {
      const cutoffTime = Date.now() - hours * 3600000;
      return metrics.filter((m) => m.timestamp >= cutoffTime);
    },
    [metrics]
  );

  const getAverageResponseTime = useCallback(() => {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + m.responseTime, 0);
    return Math.round(sum / metrics.length);
  }, [metrics]);

  const getErrorRate = useCallback(() => {
    if (metrics.length === 0) return 0;
    const totalErrors = metrics.reduce((acc, m) => acc + m.errorCount, 0);
    const totalRequests = metrics.reduce((acc, m) => acc + m.requestCount, 0);
    return totalRequests > 0 ? parseFloat(((totalErrors / totalRequests) * 100).toFixed(2)) : 0;
  }, [metrics]);

  const getTotalRequests = useCallback(() => {
    return metrics.reduce((acc, m) => acc + m.requestCount, 0);
  }, [metrics]);

  return (
    <APIMonitoringContext.Provider
      value={{
        metrics,
        endpointMetrics,
        addMetric,
        getMetricsForPeriod,
        getEndpointMetrics: () => endpointMetrics,
        getAverageResponseTime,
        getErrorRate,
        getTotalRequests,
      }}
    >
      {children}
    </APIMonitoringContext.Provider>
  );
}

export function useAPIMonitoring() {
  const context = useContext(APIMonitoringContext);
  if (!context) {
    throw new Error("useAPIMonitoring must be used within APIMonitoringProvider");
  }
  return context;
}
