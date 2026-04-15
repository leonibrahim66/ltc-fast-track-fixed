import React, { createContext, useContext, useState, useCallback } from "react";

export interface RateLimitAlert {
  id: string;
  apiKeyId: string;
  apiKeyName: string;
  threshold: number; // 80
  currentUsage: number; // percentage
  limit: number; // requests per period
  period: "minute" | "hour" | "day";
  alertType: "email" | "sms" | "push" | "in-app";
  createdAt: string;
  sentAt?: string;
  acknowledged: boolean;
}

interface RateLimitAlertsContextType {
  alerts: RateLimitAlert[];
  addAlert: (alert: Omit<RateLimitAlert, "id" | "createdAt">) => void;
  acknowledgeAlert: (alertId: string) => void;
  deleteAlert: (alertId: string) => void;
  getAlertsByApiKey: (apiKeyId: string) => RateLimitAlert[];
  getUnacknowledgedAlerts: () => RateLimitAlert[];
  checkRateLimitStatus: (apiKeyId: string, usage: number, limit: number) => boolean;
}

const RateLimitAlertsContext = createContext<RateLimitAlertsContextType | undefined>(
  undefined
);

export function RateLimitAlertsProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<RateLimitAlert[]>([
    {
      id: "alert-1",
      apiKeyId: "key-001",
      apiKeyName: "Main Integration",
      threshold: 80,
      currentUsage: 82,
      limit: 10000,
      period: "day",
      alertType: "email",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      sentAt: new Date(Date.now() - 3600000).toISOString(),
      acknowledged: false,
    },
    {
      id: "alert-2",
      apiKeyId: "key-002",
      apiKeyName: "Partner API",
      threshold: 80,
      currentUsage: 75,
      limit: 5000,
      period: "hour",
      alertType: "sms",
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      sentAt: new Date(Date.now() - 7200000).toISOString(),
      acknowledged: true,
    },
  ]);

  const addAlert = useCallback(
    (alert: Omit<RateLimitAlert, "id" | "createdAt">) => {
      const newAlert: RateLimitAlert = {
        ...alert,
        id: `alert-${Date.now()}`,
        createdAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
      };
      setAlerts((prev) => [newAlert, ...prev]);
    },
    []
  );

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  }, []);

  const deleteAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  }, []);

  const getAlertsByApiKey = useCallback(
    (apiKeyId: string) => {
      return alerts.filter((alert) => alert.apiKeyId === apiKeyId);
    },
    [alerts]
  );

  const getUnacknowledgedAlerts = useCallback(() => {
    return alerts.filter((alert) => !alert.acknowledged);
  }, [alerts]);

  const checkRateLimitStatus = useCallback(
    (apiKeyId: string, usage: number, limit: number) => {
      const percentage = (usage / limit) * 100;
      return percentage >= 80;
    },
    []
  );

  return (
    <RateLimitAlertsContext.Provider
      value={{
        alerts,
        addAlert,
        acknowledgeAlert,
        deleteAlert,
        getAlertsByApiKey,
        getUnacknowledgedAlerts,
        checkRateLimitStatus,
      }}
    >
      {children}
    </RateLimitAlertsContext.Provider>
  );
}

export function useRateLimitAlerts() {
  const context = useContext(RateLimitAlertsContext);
  if (!context) {
    throw new Error("useRateLimitAlerts must be used within RateLimitAlertsProvider");
  }
  return context;
}
