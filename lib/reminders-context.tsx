import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { PickupRequest } from "./pickups-context";

interface ReminderSettings {
  enabled: boolean;
  minutesBefore: number; // Default 60 minutes
}

interface RemindersContextType {
  settings: ReminderSettings;
  isLoading: boolean;
  updateSettings: (settings: Partial<ReminderSettings>) => Promise<void>;
  schedulePickupReminder: (pickup: PickupRequest) => Promise<string | null>;
  cancelPickupReminder: (pickupId: string) => Promise<void>;
  cancelAllReminders: () => Promise<void>;
}

const RemindersContext = createContext<RemindersContextType | undefined>(undefined);

const SETTINGS_KEY = "ltc_reminder_settings";
const SCHEDULED_REMINDERS_KEY = "ltc_scheduled_reminders";

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,
  minutesBefore: 60,
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_SETTINGS);
  const [scheduledReminders, setScheduledReminders] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load settings and scheduled reminders
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [storedSettings, storedReminders] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEY),
        AsyncStorage.getItem(SCHEDULED_REMINDERS_KEY),
      ]);

      if (storedSettings) {
        setSettings(JSON.parse(storedSettings));
      }
      if (storedReminders) {
        setScheduledReminders(JSON.parse(storedReminders));
      }
    } catch (error) {
      console.error("Failed to load reminder data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: ReminderSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error("Failed to save reminder settings:", error);
    }
  };

  const saveScheduledReminders = async (reminders: Record<string, string>) => {
    try {
      await AsyncStorage.setItem(SCHEDULED_REMINDERS_KEY, JSON.stringify(reminders));
    } catch (error) {
      console.error("Failed to save scheduled reminders:", error);
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      return false; // Web notifications not supported in this context
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  };

  const updateSettings = useCallback(async (newSettings: Partial<ReminderSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await saveSettings(updated);
  }, [settings]);

  const getTimeSlotDate = (pickup: PickupRequest): Date | null => {
    if (!pickup.scheduledDate || !pickup.scheduledTime) {
      return null;
    }

    const date = new Date(pickup.scheduledDate);
    
    // Set time based on time slot
    switch (pickup.scheduledTime) {
      case "morning":
        date.setHours(8, 0, 0, 0); // 8:00 AM
        break;
      case "afternoon":
        date.setHours(13, 0, 0, 0); // 1:00 PM
        break;
      case "evening":
        date.setHours(17, 0, 0, 0); // 5:00 PM
        break;
      default:
        return null;
    }

    return date;
  };

  const schedulePickupReminder = useCallback(async (pickup: PickupRequest): Promise<string | null> => {
    if (!settings.enabled || Platform.OS === "web") {
      return null;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return null;
    }

    const pickupTime = getTimeSlotDate(pickup);
    if (!pickupTime) {
      return null;
    }

    // Calculate reminder time (minutesBefore before pickup)
    const reminderTime = new Date(pickupTime.getTime() - settings.minutesBefore * 60 * 1000);
    
    // Don't schedule if reminder time is in the past
    if (reminderTime <= new Date()) {
      return null;
    }

    // Cancel existing reminder for this pickup if any
    if (scheduledReminders[pickup.id]) {
      await Notifications.cancelScheduledNotificationAsync(scheduledReminders[pickup.id]);
    }

    const timeSlotLabel = pickup.scheduledTime === "morning" 
      ? "Morning (8AM-12PM)"
      : pickup.scheduledTime === "afternoon"
      ? "Afternoon (12PM-5PM)"
      : "Evening (5PM-8PM)";

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "🚛 Pickup Reminder",
          body: `Your scheduled pickup is coming up in ${settings.minutesBefore} minutes! Time slot: ${timeSlotLabel}`,
          data: { pickupId: pickup.id, type: "pickup_reminder" },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderTime,
        },
      });

      const updatedReminders = { ...scheduledReminders, [pickup.id]: notificationId };
      setScheduledReminders(updatedReminders);
      await saveScheduledReminders(updatedReminders);

      return notificationId;
    } catch (error) {
      console.error("Failed to schedule reminder:", error);
      return null;
    }
  }, [settings, scheduledReminders]);

  const cancelPickupReminder = useCallback(async (pickupId: string) => {
    const notificationId = scheduledReminders[pickupId];
    if (notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        const { [pickupId]: _, ...remaining } = scheduledReminders;
        setScheduledReminders(remaining);
        await saveScheduledReminders(remaining);
      } catch (error) {
        console.error("Failed to cancel reminder:", error);
      }
    }
  }, [scheduledReminders]);

  const cancelAllReminders = useCallback(async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setScheduledReminders({});
      await saveScheduledReminders({});
    } catch (error) {
      console.error("Failed to cancel all reminders:", error);
    }
  }, []);

  return (
    <RemindersContext.Provider
      value={{
        settings,
        isLoading,
        updateSettings,
        schedulePickupReminder,
        cancelPickupReminder,
        cancelAllReminders,
      }}
    >
      {children}
    </RemindersContext.Provider>
  );
}

export function useReminders() {
  const context = useContext(RemindersContext);
  if (!context) {
    throw new Error("useReminders must be used within a RemindersProvider");
  }
  return context;
}
