import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ActivityType =
  | "login"
  | "logout"
  | "export"
  | "user_suspend"
  | "user_activate"
  | "dispute_resolve"
  | "dispute_reject"
  | "settings_change"
  | "alert_acknowledge"
  | "alert_resolve"
  | "payment_approve"
  | "payment_reject"
  | "update_create"
  | "update_delete"
  | "report_generate"
  | "driver_registered"
  | "driver_approved"
  | "driver_rejected"
  | "driver_suspended"
  | "pickup_assigned"
  | "pickup_started"
  | "pickup_completed";

export interface ActivityLog {
  id: string;
  adminId: string;
  adminName: string;
  adminRole: string;
  type: ActivityType;
  action: string;
  description: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

interface ActivityLogsContextType {
  logs: ActivityLog[];
  logActivity: (
    adminId: string,
    adminName: string,
    adminRole: string,
    type: ActivityType,
    action: string,
    description: string,
    options?: {
      targetId?: string;
      targetType?: string;
      metadata?: Record<string, any>;
    }
  ) => Promise<void>;
  getLogs: (filters?: {
    adminId?: string;
    type?: ActivityType;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => ActivityLog[];
  clearOldLogs: (daysToKeep?: number) => Promise<void>;
}

const ActivityLogsContext = createContext<ActivityLogsContextType | undefined>(undefined);

const STORAGE_KEY = "@ltc_activity_logs";

export function ActivityLogsProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLogs(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load activity logs:", error);
    }
  };

  const saveLogs = async (newLogs: ActivityLog[]) => {
    try {
      // Keep only last 1000 logs
      const trimmedLogs = newLogs.slice(0, 1000);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLogs));
    } catch (error) {
      console.error("Failed to save activity logs:", error);
    }
  };

  const logActivity = useCallback(async (
    adminId: string,
    adminName: string,
    adminRole: string,
    type: ActivityType,
    action: string,
    description: string,
    options?: {
      targetId?: string;
      targetType?: string;
      metadata?: Record<string, any>;
    }
  ) => {
    const newLog: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      adminId,
      adminName,
      adminRole,
      type,
      action,
      description,
      targetId: options?.targetId,
      targetType: options?.targetType,
      metadata: options?.metadata,
      timestamp: new Date().toISOString(),
    };

    const updated = [newLog, ...logs];
    setLogs(updated);
    await saveLogs(updated);
  }, [logs]);

  const getLogs = useCallback((filters?: {
    adminId?: string;
    type?: ActivityType;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => {
    let filtered = [...logs];

    if (filters?.adminId) {
      filtered = filtered.filter((log) => log.adminId === filters.adminId);
    }

    if (filters?.type) {
      filtered = filtered.filter((log) => log.type === filters.type);
    }

    if (filters?.startDate) {
      const start = new Date(filters.startDate);
      filtered = filtered.filter((log) => new Date(log.timestamp) >= start);
    }

    if (filters?.endDate) {
      const end = new Date(filters.endDate);
      filtered = filtered.filter((log) => new Date(log.timestamp) <= end);
    }

    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }, [logs]);

  const clearOldLogs = useCallback(async (daysToKeep: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const filtered = logs.filter((log) => new Date(log.timestamp) >= cutoffDate);
    setLogs(filtered);
    await saveLogs(filtered);
  }, [logs]);

  return (
    <ActivityLogsContext.Provider
      value={{
        logs,
        logActivity,
        getLogs,
        clearOldLogs,
      }}
    >
      {children}
    </ActivityLogsContext.Provider>
  );
}

export function useActivityLogs() {
  const context = useContext(ActivityLogsContext);
  if (!context) {
    throw new Error("useActivityLogs must be used within an ActivityLogsProvider");
  }
  return context;
}

// Helper to get activity type label
export function getActivityTypeLabel(type: ActivityType): string {
  const labels: Record<ActivityType, string> = {
    login: "Login",
    logout: "Logout",
    export: "Data Export",
    user_suspend: "User Suspended",
    user_activate: "User Activated",
    dispute_resolve: "Dispute Resolved",
    dispute_reject: "Dispute Rejected",
    settings_change: "Settings Changed",
    alert_acknowledge: "Alert Acknowledged",
    alert_resolve: "Alert Resolved",
    payment_approve: "Payment Approved",
    payment_reject: "Payment Rejected",
    update_create: "Update Created",
    update_delete: "Update Deleted",
    report_generate: "Report Generated",
    driver_registered: "Driver Registered",
    driver_approved: "Driver Approved",
    driver_rejected: "Driver Rejected",
    driver_suspended: "Driver Suspended",
    pickup_assigned: "Pickup Assigned",
    pickup_started: "Pickup Started",
    pickup_completed: "Pickup Completed",
  };
  return labels[type] || type;
}

// Helper to get activity type icon
export function getActivityTypeIcon(type: ActivityType): string {
  const icons: Record<ActivityType, string> = {
    login: "login",
    logout: "logout",
    export: "file-download",
    user_suspend: "person-off",
    user_activate: "person-add",
    dispute_resolve: "check-circle",
    dispute_reject: "cancel",
    settings_change: "settings",
    alert_acknowledge: "notifications-active",
    alert_resolve: "done-all",
    payment_approve: "check",
    payment_reject: "close",
    update_create: "add-circle",
    update_delete: "remove-circle",
    report_generate: "assessment",
    driver_registered: "person-add",
    driver_approved: "verified-user",
    driver_rejected: "person-off",
    driver_suspended: "block",
    pickup_assigned: "assignment",
    pickup_started: "local-shipping",
    pickup_completed: "check-circle",
  };
  return icons[type] || "info";
}

// Helper to get activity type color
export function getActivityTypeColor(type: ActivityType): string {
  const colors: Record<ActivityType, string> = {
    login: "#22C55E",
    logout: "#9BA1A6",
    export: "#3B82F6",
    user_suspend: "#EF4444",
    user_activate: "#22C55E",
    dispute_resolve: "#22C55E",
    dispute_reject: "#EF4444",
    settings_change: "#F59E0B",
    alert_acknowledge: "#F59E0B",
    alert_resolve: "#22C55E",
    payment_approve: "#22C55E",
    payment_reject: "#EF4444",
    update_create: "#3B82F6",
    update_delete: "#EF4444",
    report_generate: "#8B5CF6",
    driver_registered: "#2563EB",
    driver_approved: "#16A34A",
    driver_rejected: "#EF4444",
    driver_suspended: "#D97706",
    pickup_assigned: "#D97706",
    pickup_started: "#7C3AED",
    pickup_completed: "#16A34A",
  };
  return colors[type] || "#9BA1A6";
}
