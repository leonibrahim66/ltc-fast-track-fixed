import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AlertType = "dispute" | "rating" | "transaction" | "capacity" | "subscription" | "system";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved" | "dismissed";

export interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  enabled: boolean;
  condition: {
    metric: string;
    operator: "gt" | "lt" | "eq" | "gte" | "lte";
    threshold: number;
    timeWindow?: number; // in minutes
  };
  severity: AlertSeverity;
  notifyAdmin: boolean;
  notifyEmail: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  data?: Record<string, any>;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
}

interface AlertsContextType {
  rules: AlertRule[];
  alerts: Alert[];
  activeAlerts: Alert[];
  addRule: (rule: Omit<AlertRule, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateRule: (id: string, updates: Partial<AlertRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toggleRule: (id: string) => Promise<void>;
  triggerAlert: (alert: Omit<Alert, "id" | "triggeredAt" | "status">) => Promise<void>;
  acknowledgeAlert: (id: string, adminId: string) => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;
  checkAlertConditions: () => Promise<void>;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  RULES: "@ltc_alert_rules",
  ALERTS: "@ltc_alerts",
};

// Default alert rules
const DEFAULT_RULES: AlertRule[] = [
  {
    id: "rule_disputes_high",
    name: "High Dispute Volume",
    type: "dispute",
    enabled: true,
    condition: {
      metric: "pending_disputes",
      operator: "gte",
      threshold: 5,
    },
    severity: "high",
    notifyAdmin: true,
    notifyEmail: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "rule_rating_low",
    name: "Low Collector Rating",
    type: "rating",
    enabled: true,
    condition: {
      metric: "collector_avg_rating",
      operator: "lt",
      threshold: 3.0,
    },
    severity: "medium",
    notifyAdmin: true,
    notifyEmail: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "rule_transaction_unusual",
    name: "Unusual Transaction Volume",
    type: "transaction",
    enabled: true,
    condition: {
      metric: "daily_transactions",
      operator: "gt",
      threshold: 100,
      timeWindow: 1440, // 24 hours
    },
    severity: "low",
    notifyAdmin: true,
    notifyEmail: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "rule_capacity_high",
    name: "High System Load",
    type: "capacity",
    enabled: true,
    condition: {
      metric: "active_users",
      operator: "gte",
      threshold: 500,
    },
    severity: "medium",
    notifyAdmin: true,
    notifyEmail: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "rule_subscription_expiring",
    name: "Subscriptions Expiring Soon",
    type: "subscription",
    enabled: true,
    condition: {
      metric: "expiring_subscriptions",
      operator: "gte",
      threshold: 10,
    },
    severity: "low",
    notifyAdmin: true,
    notifyEmail: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const activeAlerts = alerts.filter((a) => a.status === "active");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const storedRules = await AsyncStorage.getItem(STORAGE_KEYS.RULES);
      if (storedRules) {
        setRules(JSON.parse(storedRules));
      } else {
        // Initialize with default rules
        setRules(DEFAULT_RULES);
        await AsyncStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(DEFAULT_RULES));
      }

      const storedAlerts = await AsyncStorage.getItem(STORAGE_KEYS.ALERTS);
      if (storedAlerts) {
        setAlerts(JSON.parse(storedAlerts));
      }
    } catch (error) {
      console.error("Failed to load alerts data:", error);
    }
  };

  const saveRules = async (newRules: AlertRule[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(newRules));
    } catch (error) {
      console.error("Failed to save rules:", error);
    }
  };

  const saveAlerts = async (newAlerts: Alert[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(newAlerts));
    } catch (error) {
      console.error("Failed to save alerts:", error);
    }
  };

  const addRule = useCallback(async (ruleData: Omit<AlertRule, "id" | "createdAt" | "updatedAt">) => {
    const newRule: AlertRule = {
      ...ruleData,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...rules, newRule];
    setRules(updated);
    await saveRules(updated);
  }, [rules]);

  const updateRule = useCallback(async (id: string, updates: Partial<AlertRule>) => {
    const updated = rules.map((r) =>
      r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
    );
    setRules(updated);
    await saveRules(updated);
  }, [rules]);

  const deleteRule = useCallback(async (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    await saveRules(updated);
  }, [rules]);

  const toggleRule = useCallback(async (id: string) => {
    const updated = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() } : r
    );
    setRules(updated);
    await saveRules(updated);
  }, [rules]);

  const triggerAlert = useCallback(async (alertData: Omit<Alert, "id" | "triggeredAt" | "status">) => {
    // Check if similar alert already exists and is active
    const existingAlert = alerts.find(
      (a) => a.ruleId === alertData.ruleId && a.status === "active"
    );
    if (existingAlert) return;

    const newAlert: Alert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: "active",
      triggeredAt: new Date().toISOString(),
    };
    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    await saveAlerts(updated);
  }, [alerts]);

  const acknowledgeAlert = useCallback(async (id: string, adminId: string) => {
    const updated = alerts.map((a) =>
      a.id === id
        ? { ...a, status: "acknowledged" as AlertStatus, acknowledgedAt: new Date().toISOString(), acknowledgedBy: adminId }
        : a
    );
    setAlerts(updated);
    await saveAlerts(updated);
  }, [alerts]);

  const resolveAlert = useCallback(async (id: string) => {
    const updated = alerts.map((a) =>
      a.id === id
        ? { ...a, status: "resolved" as AlertStatus, resolvedAt: new Date().toISOString() }
        : a
    );
    setAlerts(updated);
    await saveAlerts(updated);
  }, [alerts]);

  const dismissAlert = useCallback(async (id: string) => {
    const updated = alerts.map((a) =>
      a.id === id ? { ...a, status: "dismissed" as AlertStatus } : a
    );
    setAlerts(updated);
    await saveAlerts(updated);
  }, [alerts]);

  const checkAlertConditions = useCallback(async () => {
    try {
      // Load current metrics
      const usersDb = await AsyncStorage.getItem("@ltc_users_db");
      const pickupsData = await AsyncStorage.getItem("ltc_pickups");
      const disputesData = await AsyncStorage.getItem("ltc_disputes");
      const paymentsData = await AsyncStorage.getItem("ltc_payments");

      const users = usersDb ? Object.values(JSON.parse(usersDb)) as any[] : [];
      const pickups = pickupsData ? JSON.parse(pickupsData) : [];
      const disputes = disputesData ? JSON.parse(disputesData) : [];
      const payments = paymentsData ? JSON.parse(paymentsData) : [];

      // Calculate metrics
      const metrics: Record<string, number> = {
        pending_disputes: disputes.filter((d: any) => d.status === "open" || d.status === "investigating").length,
        collector_avg_rating: calculateAvgRating(pickups),
        daily_transactions: payments.filter((p: any) => isToday(p.createdAt)).length,
        active_users: users.length,
        expiring_subscriptions: users.filter((u: any) => isExpiringSoon(u.subscriptionEndDate)).length,
      };

      // Check each enabled rule
      for (const rule of rules.filter((r) => r.enabled)) {
        const metricValue = metrics[rule.condition.metric] ?? 0;
        const triggered = evaluateCondition(metricValue, rule.condition.operator, rule.condition.threshold);

        if (triggered) {
          await triggerAlert({
            ruleId: rule.id,
            ruleName: rule.name,
            type: rule.type,
            severity: rule.severity,
            title: rule.name,
            message: `${rule.name}: Current value (${metricValue}) ${getOperatorText(rule.condition.operator)} threshold (${rule.condition.threshold})`,
            data: { metricValue, threshold: rule.condition.threshold },
          });
        }
      }
    } catch (error) {
      console.error("Failed to check alert conditions:", error);
    }
  }, [rules, triggerAlert]);

  return (
    <AlertsContext.Provider
      value={{
        rules,
        alerts,
        activeAlerts,
        addRule,
        updateRule,
        deleteRule,
        toggleRule,
        triggerAlert,
        acknowledgeAlert,
        resolveAlert,
        dismissAlert,
        checkAlertConditions,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error("useAlerts must be used within an AlertsProvider");
  }
  return context;
}

// Helper functions
function evaluateCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "lt":
      return value < threshold;
    case "eq":
      return value === threshold;
    case "gte":
      return value >= threshold;
    case "lte":
      return value <= threshold;
    default:
      return false;
  }
}

function getOperatorText(operator: string): string {
  switch (operator) {
    case "gt":
      return ">";
    case "lt":
      return "<";
    case "eq":
      return "=";
    case "gte":
      return "≥";
    case "lte":
      return "≤";
    default:
      return operator;
  }
}

function calculateAvgRating(pickups: any[]): number {
  const rated = pickups.filter((p) => p.rating);
  if (rated.length === 0) return 5;
  return rated.reduce((sum, p) => sum + p.rating, 0) / rated.length;
}

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isExpiringSoon(dateStr?: string): boolean {
  if (!dateStr) return false;
  const endDate = new Date(dateStr);
  const now = new Date();
  const daysUntilExpiry = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
}
