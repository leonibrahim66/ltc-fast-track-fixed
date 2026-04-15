import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ReportFrequency = "daily" | "weekly" | "monthly";
export type ReportType = "summary" | "transactions" | "users" | "pickups" | "disputes";

export interface ScheduledReport {
  id: string;
  name: string;
  type: ReportType;
  frequency: ReportFrequency;
  enabled: boolean;
  recipients: string[]; // email addresses
  lastGenerated?: string;
  nextScheduled?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedReport {
  id: string;
  scheduleId: string;
  scheduleName: string;
  type: ReportType;
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  stats: Record<string, any>;
  status: "generated" | "sent" | "failed";
  error?: string;
}

interface ScheduledReportsContextType {
  schedules: ScheduledReport[];
  reports: GeneratedReport[];
  addSchedule: (schedule: Omit<ScheduledReport, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateSchedule: (id: string, updates: Partial<ScheduledReport>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  toggleSchedule: (id: string) => Promise<void>;
  generateReport: (scheduleId: string) => Promise<GeneratedReport | null>;
  getReportsBySchedule: (scheduleId: string) => GeneratedReport[];
}

const ScheduledReportsContext = createContext<ScheduledReportsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  SCHEDULES: "@ltc_report_schedules",
  REPORTS: "@ltc_generated_reports",
};

export function ScheduledReportsProvider({ children }: { children: ReactNode }) {
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const storedSchedules = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULES);
      if (storedSchedules) {
        setSchedules(JSON.parse(storedSchedules));
      }

      const storedReports = await AsyncStorage.getItem(STORAGE_KEYS.REPORTS);
      if (storedReports) {
        setReports(JSON.parse(storedReports));
      }
    } catch (error) {
      console.error("Failed to load scheduled reports:", error);
    }
  };

  const saveSchedules = async (newSchedules: ScheduledReport[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(newSchedules));
    } catch (error) {
      console.error("Failed to save schedules:", error);
    }
  };

  const saveReports = async (newReports: GeneratedReport[]) => {
    try {
      // Keep only last 100 reports
      const trimmedReports = newReports.slice(0, 100);
      await AsyncStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(trimmedReports));
    } catch (error) {
      console.error("Failed to save reports:", error);
    }
  };

  const calculateNextScheduled = (frequency: ReportFrequency): string => {
    const now = new Date();
    switch (frequency) {
      case "daily":
        now.setDate(now.getDate() + 1);
        now.setHours(8, 0, 0, 0); // 8 AM next day
        break;
      case "weekly":
        now.setDate(now.getDate() + (7 - now.getDay() + 1)); // Next Monday
        now.setHours(8, 0, 0, 0);
        break;
      case "monthly":
        now.setMonth(now.getMonth() + 1);
        now.setDate(1); // First of next month
        now.setHours(8, 0, 0, 0);
        break;
    }
    return now.toISOString();
  };

  const addSchedule = useCallback(async (scheduleData: Omit<ScheduledReport, "id" | "createdAt" | "updatedAt">) => {
    const newSchedule: ScheduledReport = {
      ...scheduleData,
      id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nextScheduled: calculateNextScheduled(scheduleData.frequency),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...schedules, newSchedule];
    setSchedules(updated);
    await saveSchedules(updated);
  }, [schedules]);

  const updateSchedule = useCallback(async (id: string, updates: Partial<ScheduledReport>) => {
    const updated = schedules.map((s) => {
      if (s.id === id) {
        const newSchedule = { ...s, ...updates, updatedAt: new Date().toISOString() };
        if (updates.frequency) {
          newSchedule.nextScheduled = calculateNextScheduled(updates.frequency);
        }
        return newSchedule;
      }
      return s;
    });
    setSchedules(updated);
    await saveSchedules(updated);
  }, [schedules]);

  const deleteSchedule = useCallback(async (id: string) => {
    const updated = schedules.filter((s) => s.id !== id);
    setSchedules(updated);
    await saveSchedules(updated);
  }, [schedules]);

  const toggleSchedule = useCallback(async (id: string) => {
    const updated = schedules.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled, updatedAt: new Date().toISOString() } : s
    );
    setSchedules(updated);
    await saveSchedules(updated);
  }, [schedules]);

  const generateReport = useCallback(async (scheduleId: string): Promise<GeneratedReport | null> => {
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return null;

    try {
      // Calculate period based on frequency
      const now = new Date();
      let periodStart = new Date();
      switch (schedule.frequency) {
        case "daily":
          periodStart.setDate(now.getDate() - 1);
          break;
        case "weekly":
          periodStart.setDate(now.getDate() - 7);
          break;
        case "monthly":
          periodStart.setMonth(now.getMonth() - 1);
          break;
      }

      // Load data for report
      const usersDb = await AsyncStorage.getItem("@ltc_users_db");
      const pickupsData = await AsyncStorage.getItem("ltc_pickups");
      const paymentsData = await AsyncStorage.getItem("ltc_payments");
      const disputesData = await AsyncStorage.getItem("ltc_disputes");

      const users = usersDb ? Object.values(JSON.parse(usersDb)) as any[] : [];
      const pickups = pickupsData ? JSON.parse(pickupsData) : [];
      const payments = paymentsData ? JSON.parse(paymentsData) : [];
      const disputes = disputesData ? JSON.parse(disputesData) : [];

      // Generate stats based on report type
      let stats: Record<string, any> = {};
      switch (schedule.type) {
        case "summary":
          stats = {
            totalUsers: users.length,
            newUsers: users.filter((u: any) => new Date(u.createdAt) >= periodStart).length,
            totalPickups: pickups.length,
            completedPickups: pickups.filter((p: any) => p.status === "completed").length,
            totalRevenue: payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
            pendingDisputes: disputes.filter((d: any) => d.status === "open").length,
          };
          break;
        case "transactions":
          const periodPayments = payments.filter((p: any) => new Date(p.createdAt) >= periodStart);
          stats = {
            totalTransactions: periodPayments.length,
            totalAmount: periodPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
            byMethod: {
              mtn: periodPayments.filter((p: any) => p.method === "mtn").length,
              airtel: periodPayments.filter((p: any) => p.method === "airtel").length,
              bank: periodPayments.filter((p: any) => p.method === "bank").length,
            },
            byStatus: {
              completed: periodPayments.filter((p: any) => p.status === "completed").length,
              pending: periodPayments.filter((p: any) => p.status === "pending").length,
              failed: periodPayments.filter((p: any) => p.status === "failed").length,
            },
          };
          break;
        case "users":
          const periodUsers = users.filter((u: any) => new Date(u.createdAt) >= periodStart);
          stats = {
            newRegistrations: periodUsers.length,
            byRole: {
              customers: periodUsers.filter((u: any) => u.role === "customer" || u.role === "commercial").length,
              collectors: periodUsers.filter((u: any) => u.role === "collector").length,
              recyclers: periodUsers.filter((u: any) => u.role === "recycler").length,
            },
            activeSubscriptions: users.filter((u: any) => u.subscriptionStatus === "active").length,
          };
          break;
        case "pickups":
          const periodPickups = pickups.filter((p: any) => new Date(p.createdAt) >= periodStart);
          stats = {
            totalPickups: periodPickups.length,
            completed: periodPickups.filter((p: any) => p.status === "completed").length,
            pending: periodPickups.filter((p: any) => p.status === "pending").length,
            avgRating: calculateAvgRating(periodPickups),
          };
          break;
        case "disputes":
          const periodDisputes = disputes.filter((d: any) => new Date(d.createdAt) >= periodStart);
          stats = {
            totalDisputes: periodDisputes.length,
            resolved: periodDisputes.filter((d: any) => d.status === "resolved").length,
            pending: periodDisputes.filter((d: any) => d.status === "open" || d.status === "investigating").length,
            byType: periodDisputes.reduce((acc: any, d: any) => {
              acc[d.issueType] = (acc[d.issueType] || 0) + 1;
              return acc;
            }, {}),
          };
          break;
      }

      const newReport: GeneratedReport = {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        type: schedule.type,
        generatedAt: new Date().toISOString(),
        period: {
          start: periodStart.toISOString(),
          end: now.toISOString(),
        },
        stats,
        status: "generated",
      };

      // Update schedule with last generated time
      const updatedSchedules = schedules.map((s) =>
        s.id === scheduleId
          ? {
              ...s,
              lastGenerated: new Date().toISOString(),
              nextScheduled: calculateNextScheduled(s.frequency),
              updatedAt: new Date().toISOString(),
            }
          : s
      );
      setSchedules(updatedSchedules);
      await saveSchedules(updatedSchedules);

      // Save report
      const updatedReports = [newReport, ...reports];
      setReports(updatedReports);
      await saveReports(updatedReports);

      return newReport;
    } catch (error) {
      console.error("Failed to generate report:", error);
      return null;
    }
  }, [schedules, reports]);

  const getReportsBySchedule = useCallback((scheduleId: string) => {
    return reports.filter((r) => r.scheduleId === scheduleId);
  }, [reports]);

  return (
    <ScheduledReportsContext.Provider
      value={{
        schedules,
        reports,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        toggleSchedule,
        generateReport,
        getReportsBySchedule,
      }}
    >
      {children}
    </ScheduledReportsContext.Provider>
  );
}

export function useScheduledReports() {
  const context = useContext(ScheduledReportsContext);
  if (!context) {
    throw new Error("useScheduledReports must be used within a ScheduledReportsProvider");
  }
  return context;
}

// Helper function
function calculateAvgRating(pickups: any[]): number {
  const rated = pickups.filter((p) => p.rating);
  if (rated.length === 0) return 0;
  return Number((rated.reduce((sum, p) => sum + p.rating, 0) / rated.length).toFixed(1));
}
