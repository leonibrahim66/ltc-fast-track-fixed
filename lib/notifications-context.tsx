import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type NotificationType = "payment" | "pickup" | "system" | "promo";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  addNotification: (notification: Omit<Notification, "id" | "read" | "createdAt">) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const STORAGE_KEY = "ltc_notifications";

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Load notifications from storage
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setNotifications(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveNotifications = async (newNotifications: Notification[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newNotifications));
    } catch (error) {
      console.error("Failed to save notifications:", error);
    }
  };

  const generateId = () => {
    return `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addNotification = useCallback(async (
    notificationData: Omit<Notification, "id" | "read" | "createdAt">
  ) => {
    const newNotification: Notification = {
      ...notificationData,
      id: generateId(),
      read: false,
      createdAt: new Date().toISOString(),
    };

    const updatedNotifications = [newNotification, ...notifications];
    setNotifications(updatedNotifications);
    await saveNotifications(updatedNotifications);
  }, [notifications]);

  const markAsRead = useCallback(async (id: string) => {
    const updatedNotifications = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updatedNotifications);
    await saveNotifications(updatedNotifications);
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    const updatedNotifications = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updatedNotifications);
    await saveNotifications(updatedNotifications);
  }, [notifications]);

  const clearNotification = useCallback(async (id: string) => {
    const updatedNotifications = notifications.filter((n) => n.id !== id);
    setNotifications(updatedNotifications);
    await saveNotifications(updatedNotifications);
  }, [notifications]);

  const clearAllNotifications = useCallback(async () => {
    setNotifications([]);
    await saveNotifications([]);
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAllNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}

// Helper function to create payment status notification
export function createPaymentNotification(
  status: "confirmed" | "failed",
  amount: number,
  reference: string,
  currency: string = "ZMW"
): Omit<Notification, "id" | "read" | "createdAt"> {
  if (status === "confirmed") {
    return {
      type: "payment",
      title: "Payment Confirmed",
      message: `Your payment of ${currency} ${amount.toLocaleString()} (Ref: ${reference}) has been confirmed.`,
      data: { status, amount, reference },
    };
  } else {
    return {
      type: "payment",
      title: "Payment Failed",
      message: `Your payment of ${currency} ${amount.toLocaleString()} (Ref: ${reference}) was not approved. Please contact support.`,
      data: { status, amount, reference },
    };
  }
}
