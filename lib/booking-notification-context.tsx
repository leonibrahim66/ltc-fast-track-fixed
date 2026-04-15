import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BookingNotification } from "@/types/booking";

interface BookingNotificationContextType {
  notifications: BookingNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<BookingNotification, "id" | "createdAt">) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  loadNotifications: () => Promise<void>;
}

const BookingNotificationContext = createContext<BookingNotificationContextType | undefined>(
  undefined
);

const STORAGE_KEY = "customer_booking_notifications";

export function BookingNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<BookingNotification[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: BookingNotification[] = JSON.parse(stored);
        // Sort by newest first
        parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(parsed);
      }
    } catch (error) {
      console.error("Error loading booking notifications:", error);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const saveNotifications = async (notifs: BookingNotification[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
      setNotifications(notifs);
    } catch (error) {
      console.error("Error saving booking notifications:", error);
    }
  };

  const addNotification = async (
    notification: Omit<BookingNotification, "id" | "createdAt">
  ) => {
    const newNotif: BookingNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newNotif, ...notifications];
    await saveNotifications(updated);
  };

  const markAsRead = async (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    await saveNotifications(updated);
  };

  const markAllAsRead = async () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    await saveNotifications(updated);
  };

  const clearAll = async () => {
    await saveNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <BookingNotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        loadNotifications,
      }}
    >
      {children}
    </BookingNotificationContext.Provider>
  );
}

export function useBookingNotifications() {
  const context = useContext(BookingNotificationContext);
  if (!context) {
    throw new Error("useBookingNotifications must be used within BookingNotificationProvider");
  }
  return context;
}
