import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";

const STORAGE_KEY = "ltc_alert_sounds_settings";

export type AlertType = 
  | "new_dispute"
  | "payment_failure"
  | "new_registration"
  | "new_subscription"
  | "pickup_completed"
  | "critical_alert";

export interface AlertSoundSettings {
  enabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  volume: number; // 0-100
  alertTypes: Record<AlertType, boolean>;
}

const DEFAULT_SETTINGS: AlertSoundSettings = {
  enabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  volume: 80,
  alertTypes: {
    new_dispute: true,
    payment_failure: true,
    new_registration: true,
    new_subscription: true,
    pickup_completed: false,
    critical_alert: true,
  },
};

const ALERT_CONFIG: Record<AlertType, { 
  label: string; 
  description: string;
  vibrationPattern: number[];
  hapticType: Haptics.NotificationFeedbackType;
  priority: "high" | "medium" | "low";
}> = {
  new_dispute: {
    label: "New Dispute",
    description: "When a customer reports an issue",
    vibrationPattern: [0, 200, 100, 200, 100, 200],
    hapticType: Haptics.NotificationFeedbackType.Warning,
    priority: "high",
  },
  payment_failure: {
    label: "Payment Failure",
    description: "When a payment fails or is rejected",
    vibrationPattern: [0, 500, 200, 500],
    hapticType: Haptics.NotificationFeedbackType.Error,
    priority: "high",
  },
  new_registration: {
    label: "New Registration",
    description: "When a new user signs up",
    vibrationPattern: [0, 100, 50, 100],
    hapticType: Haptics.NotificationFeedbackType.Success,
    priority: "low",
  },
  new_subscription: {
    label: "New Subscription",
    description: "When a user subscribes to a plan",
    vibrationPattern: [0, 150, 75, 150],
    hapticType: Haptics.NotificationFeedbackType.Success,
    priority: "medium",
  },
  pickup_completed: {
    label: "Pickup Completed",
    description: "When a collector completes a pickup",
    vibrationPattern: [0, 100],
    hapticType: Haptics.NotificationFeedbackType.Success,
    priority: "low",
  },
  critical_alert: {
    label: "Critical Alert",
    description: "System critical notifications",
    vibrationPattern: [0, 300, 100, 300, 100, 300, 100, 300],
    hapticType: Haptics.NotificationFeedbackType.Error,
    priority: "high",
  },
};

interface AlertSoundsContextType {
  settings: AlertSoundSettings;
  updateSettings: (updates: Partial<AlertSoundSettings>) => Promise<void>;
  toggleAlertType: (type: AlertType) => Promise<void>;
  triggerAlert: (type: AlertType) => void;
  testAlert: (type: AlertType) => void;
  getAlertConfig: (type: AlertType) => typeof ALERT_CONFIG[AlertType];
  alertTypes: AlertType[];
}

const AlertSoundsContext = createContext<AlertSoundsContextType | undefined>(undefined);

export function AlertSoundsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AlertSoundSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error("Failed to load alert sound settings:", error);
    }
  };

  const saveSettings = async (newSettings: AlertSoundSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error("Failed to save alert sound settings:", error);
    }
  };

  const updateSettings = async (updates: Partial<AlertSoundSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const toggleAlertType = async (type: AlertType) => {
    const newAlertTypes = {
      ...settings.alertTypes,
      [type]: !settings.alertTypes[type],
    };
    const newSettings = { ...settings, alertTypes: newAlertTypes };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const triggerAlert = useCallback((type: AlertType) => {
    if (!settings.enabled || !settings.alertTypes[type]) {
      return;
    }

    const config = ALERT_CONFIG[type];

    // Trigger vibration
    if (settings.vibrationEnabled && Platform.OS !== "web") {
      if (Platform.OS === "android") {
        Vibration.vibrate(config.vibrationPattern);
      } else {
        // iOS uses haptics
        Haptics.notificationAsync(config.hapticType);
      }
    }

    // Sound would be triggered here with expo-av if needed
    // For now, we use haptics as audio feedback
    if (settings.soundEnabled && Platform.OS !== "web") {
      // Additional haptic for sound simulation
      Haptics.impactAsync(
        config.priority === "high" 
          ? Haptics.ImpactFeedbackStyle.Heavy 
          : config.priority === "medium"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      );
    }
  }, [settings]);

  const testAlert = (type: AlertType) => {
    const config = ALERT_CONFIG[type];
    
    if (Platform.OS !== "web") {
      // Always trigger for testing regardless of settings
      if (Platform.OS === "android") {
        Vibration.vibrate(config.vibrationPattern);
      } else {
        Haptics.notificationAsync(config.hapticType);
      }
      
      // Additional haptic feedback
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 100);
    }
  };

  const getAlertConfig = (type: AlertType) => ALERT_CONFIG[type];

  const alertTypes: AlertType[] = [
    "new_dispute",
    "payment_failure",
    "new_registration",
    "new_subscription",
    "pickup_completed",
    "critical_alert",
  ];

  return (
    <AlertSoundsContext.Provider
      value={{
        settings,
        updateSettings,
        toggleAlertType,
        triggerAlert,
        testAlert,
        getAlertConfig,
        alertTypes,
      }}
    >
      {children}
    </AlertSoundsContext.Provider>
  );
}

export function useAlertSounds() {
  const context = useContext(AlertSoundsContext);
  if (!context) {
    throw new Error("useAlertSounds must be used within AlertSoundsProvider");
  }
  return context;
}
