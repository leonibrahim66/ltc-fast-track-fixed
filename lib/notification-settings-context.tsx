import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type NotificationChannel = "email" | "sms" | "push" | "inApp";
export type AlertPriority = "all" | "high" | "critical";

export interface NotificationRecipient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  channels: NotificationChannel[];
  alertPriority: AlertPriority;
  enabled: boolean;
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  alertType: string;
  subject: string;
  emailBody: string;
  smsBody: string;
  enabled: boolean;
}

export interface NotificationLog {
  id: string;
  recipientId: string;
  recipientName: string;
  channel: NotificationChannel;
  alertType: string;
  subject: string;
  status: "sent" | "failed" | "pending";
  sentAt: string;
  error?: string;
}

interface NotificationSettingsContextType {
  recipients: NotificationRecipient[];
  templates: NotificationTemplate[];
  logs: NotificationLog[];
  addRecipient: (recipient: Omit<NotificationRecipient, "id" | "createdAt">) => Promise<void>;
  updateRecipient: (id: string, updates: Partial<NotificationRecipient>) => Promise<void>;
  deleteRecipient: (id: string) => Promise<void>;
  toggleRecipient: (id: string) => Promise<void>;
  updateTemplate: (id: string, updates: Partial<NotificationTemplate>) => Promise<void>;
  sendNotification: (alertType: string, severity: string, title: string, message: string) => Promise<void>;
  getRecentLogs: (limit?: number) => NotificationLog[];
}

const NotificationSettingsContext = createContext<NotificationSettingsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  RECIPIENTS: "@ltc_notification_recipients",
  TEMPLATES: "@ltc_notification_templates",
  LOGS: "@ltc_notification_logs",
};

// Default notification templates
const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: "template_dispute",
    name: "Dispute Alert",
    alertType: "dispute",
    subject: "LTC Alert: High Dispute Volume",
    emailBody: "Dear Admin,\n\nThe system has detected an elevated number of pending disputes ({{count}}).\n\nPlease review and address these issues promptly.\n\nBest regards,\nLTC FAST TRACK System",
    smsBody: "LTC Alert: {{count}} pending disputes require attention. Please check admin panel.",
    enabled: true,
  },
  {
    id: "template_rating",
    name: "Low Rating Alert",
    alertType: "rating",
    subject: "LTC Alert: Collector Rating Below Threshold",
    emailBody: "Dear Admin,\n\nA collector's average rating has dropped below the acceptable threshold.\n\nCollector: {{collectorName}}\nCurrent Rating: {{rating}}/5\n\nPlease review their recent performance.\n\nBest regards,\nLTC FAST TRACK System",
    smsBody: "LTC Alert: Collector {{collectorName}} rating dropped to {{rating}}/5. Review needed.",
    enabled: true,
  },
  {
    id: "template_transaction",
    name: "Transaction Alert",
    alertType: "transaction",
    subject: "LTC Alert: Unusual Transaction Activity",
    emailBody: "Dear Admin,\n\nUnusual transaction activity has been detected.\n\nDaily Transactions: {{count}}\nTotal Amount: K{{amount}}\n\nPlease verify these transactions.\n\nBest regards,\nLTC FAST TRACK System",
    smsBody: "LTC Alert: Unusual transaction activity - {{count}} transactions today. Please verify.",
    enabled: true,
  },
  {
    id: "template_subscription",
    name: "Subscription Alert",
    alertType: "subscription",
    subject: "LTC Alert: Subscriptions Expiring Soon",
    emailBody: "Dear Admin,\n\n{{count}} subscriptions are expiring within the next 7 days.\n\nPlease consider sending renewal reminders to affected customers.\n\nBest regards,\nLTC FAST TRACK System",
    smsBody: "LTC Alert: {{count}} subscriptions expiring soon. Send renewal reminders.",
    enabled: true,
  },
  {
    id: "template_system",
    name: "System Alert",
    alertType: "system",
    subject: "LTC Alert: System Notification",
    emailBody: "Dear Admin,\n\nSystem Alert: {{title}}\n\n{{message}}\n\nBest regards,\nLTC FAST TRACK System",
    smsBody: "LTC System Alert: {{title}}. Check admin panel for details.",
    enabled: true,
  },
];

export function NotificationSettingsProvider({ children }: { children: ReactNode }) {
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const storedRecipients = await AsyncStorage.getItem(STORAGE_KEYS.RECIPIENTS);
      if (storedRecipients) {
        setRecipients(JSON.parse(storedRecipients));
      }

      const storedTemplates = await AsyncStorage.getItem(STORAGE_KEYS.TEMPLATES);
      if (storedTemplates) {
        setTemplates(JSON.parse(storedTemplates));
      } else {
        setTemplates(DEFAULT_TEMPLATES);
        await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(DEFAULT_TEMPLATES));
      }

      const storedLogs = await AsyncStorage.getItem(STORAGE_KEYS.LOGS);
      if (storedLogs) {
        setLogs(JSON.parse(storedLogs));
      }
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    }
  };

  const saveRecipients = async (newRecipients: NotificationRecipient[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RECIPIENTS, JSON.stringify(newRecipients));
    } catch (error) {
      console.error("Failed to save recipients:", error);
    }
  };

  const saveTemplates = async (newTemplates: NotificationTemplate[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(newTemplates));
    } catch (error) {
      console.error("Failed to save templates:", error);
    }
  };

  const saveLogs = async (newLogs: NotificationLog[]) => {
    try {
      // Keep only last 500 logs
      const trimmedLogs = newLogs.slice(0, 500);
      await AsyncStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(trimmedLogs));
    } catch (error) {
      console.error("Failed to save logs:", error);
    }
  };

  const addRecipient = useCallback(async (recipientData: Omit<NotificationRecipient, "id" | "createdAt">) => {
    const newRecipient: NotificationRecipient = {
      ...recipientData,
      id: `recipient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...recipients, newRecipient];
    setRecipients(updated);
    await saveRecipients(updated);
  }, [recipients]);

  const updateRecipient = useCallback(async (id: string, updates: Partial<NotificationRecipient>) => {
    const updated = recipients.map((r) => (r.id === id ? { ...r, ...updates } : r));
    setRecipients(updated);
    await saveRecipients(updated);
  }, [recipients]);

  const deleteRecipient = useCallback(async (id: string) => {
    const updated = recipients.filter((r) => r.id !== id);
    setRecipients(updated);
    await saveRecipients(updated);
  }, [recipients]);

  const toggleRecipient = useCallback(async (id: string) => {
    const updated = recipients.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    setRecipients(updated);
    await saveRecipients(updated);
  }, [recipients]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<NotificationTemplate>) => {
    const updated = templates.map((t) => (t.id === id ? { ...t, ...updates } : t));
    setTemplates(updated);
    await saveTemplates(updated);
  }, [templates]);

  const sendNotification = useCallback(async (
    alertType: string,
    severity: string,
    title: string,
    message: string
  ) => {
    // Find matching template
    const template = templates.find((t) => t.alertType === alertType && t.enabled);
    if (!template) return;

    // Get eligible recipients based on severity
    const eligibleRecipients = recipients.filter((r) => {
      if (!r.enabled) return false;
      if (r.alertPriority === "all") return true;
      if (r.alertPriority === "high" && (severity === "high" || severity === "critical")) return true;
      if (r.alertPriority === "critical" && severity === "critical") return true;
      return false;
    });

    const newLogs: NotificationLog[] = [];

    for (const recipient of eligibleRecipients) {
      for (const channel of recipient.channels) {
        // Simulate sending notification
        const log: NotificationLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          recipientId: recipient.id,
          recipientName: recipient.name,
          channel,
          alertType,
          subject: template.subject.replace("{{title}}", title),
          status: "sent", // In real implementation, this would be based on actual send result
          sentAt: new Date().toISOString(),
        };

        // Simulate email/SMS sending (in production, integrate with actual services)
        if (channel === "email" && recipient.email) {
          console.log(`[EMAIL] To: ${recipient.email}, Subject: ${template.subject}`);
        } else if (channel === "sms" && recipient.phone) {
          console.log(`[SMS] To: ${recipient.phone}, Message: ${template.smsBody}`);
        }

        newLogs.push(log);
      }
    }

    if (newLogs.length > 0) {
      const updated = [...newLogs, ...logs];
      setLogs(updated);
      await saveLogs(updated);
    }
  }, [recipients, templates, logs]);

  const getRecentLogs = useCallback((limit: number = 50) => {
    return logs.slice(0, limit);
  }, [logs]);

  return (
    <NotificationSettingsContext.Provider
      value={{
        recipients,
        templates,
        logs,
        addRecipient,
        updateRecipient,
        deleteRecipient,
        toggleRecipient,
        updateTemplate,
        sendNotification,
        getRecentLogs,
      }}
    >
      {children}
    </NotificationSettingsContext.Provider>
  );
}

export function useNotificationSettings() {
  const context = useContext(NotificationSettingsContext);
  if (!context) {
    throw new Error("useNotificationSettings must be used within a NotificationSettingsProvider");
  }
  return context;
}
