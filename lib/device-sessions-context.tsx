import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const DEVICE_SESSIONS_KEY = "@ltc_device_sessions";
const CURRENT_DEVICE_KEY = "@ltc_current_device";

export interface DeviceSession {
  id: string;
  deviceName: string;
  deviceType: "phone" | "tablet" | "desktop" | "unknown";
  platform: string;
  lastActive: string;
  location?: string;
  isCurrentDevice: boolean;
  loginTime: string;
  ipAddress?: string;
}

interface DeviceSessionsContextType {
  sessions: DeviceSession[];
  currentDeviceId: string | null;
  isLoading: boolean;
  registerDevice: () => Promise<string>;
  updateLastActive: () => Promise<void>;
  logoutDevice: (deviceId: string) => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  logoutOtherDevices: () => Promise<void>;
  refreshSessions: () => Promise<void>;
}

const DeviceSessionsContext = createContext<DeviceSessionsContextType | undefined>(undefined);

export function DeviceSessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const generateDeviceId = () => {
    return `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const getDeviceInfo = (): Partial<DeviceSession> => {
    let deviceName = "Unknown Device";
    let deviceType: DeviceSession["deviceType"] = "unknown";
    let platform = "Unknown";

    if (Platform.OS === "web") {
      deviceName = "Web Browser";
      deviceType = "desktop";
      platform = "Web";
    } else if (Platform.OS === "ios") {
      deviceName = "iPhone/iPad";
      deviceType = "phone";
      platform = "iOS";
    } else if (Platform.OS === "android") {
      deviceName = "Android Device";
      deviceType = "phone";
      platform = "Android";
    }

    return {
      deviceName,
      deviceType,
      platform,
    };
  };

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const storedSessions = await AsyncStorage.getItem(DEVICE_SESSIONS_KEY);
      const storedDeviceId = await AsyncStorage.getItem(CURRENT_DEVICE_KEY);
      
      if (storedSessions) {
        const parsedSessions: DeviceSession[] = JSON.parse(storedSessions);
        // Mark current device
        const updatedSessions = parsedSessions.map(session => ({
          ...session,
          isCurrentDevice: session.id === storedDeviceId,
        }));
        setSessions(updatedSessions);
      }
      
      if (storedDeviceId) {
        setCurrentDeviceId(storedDeviceId);
      }
    } catch (error) {
      console.error("Error loading device sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSessions = async (newSessions: DeviceSession[]) => {
    try {
      await AsyncStorage.setItem(DEVICE_SESSIONS_KEY, JSON.stringify(newSessions));
      setSessions(newSessions);
    } catch (error) {
      console.error("Error saving device sessions:", error);
    }
  };

  const registerDevice = async (): Promise<string> => {
    const deviceId = generateDeviceId();
    const deviceInfo = getDeviceInfo();
    
    const newSession: DeviceSession = {
      id: deviceId,
      deviceName: deviceInfo.deviceName || "Unknown Device",
      deviceType: deviceInfo.deviceType || "unknown",
      platform: deviceInfo.platform || "Unknown",
      lastActive: new Date().toISOString(),
      loginTime: new Date().toISOString(),
      isCurrentDevice: true,
      location: "Zambia", // Default location
    };

    // Update existing sessions to mark them as not current
    const updatedSessions = sessions.map(s => ({ ...s, isCurrentDevice: false }));
    const newSessions = [...updatedSessions, newSession];
    
    await AsyncStorage.setItem(CURRENT_DEVICE_KEY, deviceId);
    await saveSessions(newSessions);
    setCurrentDeviceId(deviceId);
    
    return deviceId;
  };

  const updateLastActive = async () => {
    if (!currentDeviceId) return;
    
    const updatedSessions = sessions.map(session => {
      if (session.id === currentDeviceId) {
        return { ...session, lastActive: new Date().toISOString() };
      }
      return session;
    });
    
    await saveSessions(updatedSessions);
  };

  const logoutDevice = async (deviceId: string) => {
    const newSessions = sessions.filter(s => s.id !== deviceId);
    await saveSessions(newSessions);
    
    if (deviceId === currentDeviceId) {
      await AsyncStorage.removeItem(CURRENT_DEVICE_KEY);
      setCurrentDeviceId(null);
    }
  };

  const logoutAllDevices = async () => {
    await AsyncStorage.removeItem(DEVICE_SESSIONS_KEY);
    await AsyncStorage.removeItem(CURRENT_DEVICE_KEY);
    setSessions([]);
    setCurrentDeviceId(null);
  };

  const logoutOtherDevices = async () => {
    if (!currentDeviceId) return;
    
    const currentSession = sessions.find(s => s.id === currentDeviceId);
    if (currentSession) {
      await saveSessions([currentSession]);
    }
  };

  const refreshSessions = async () => {
    await loadSessions();
  };

  return (
    <DeviceSessionsContext.Provider
      value={{
        sessions,
        currentDeviceId,
        isLoading,
        registerDevice,
        updateLastActive,
        logoutDevice,
        logoutAllDevices,
        logoutOtherDevices,
        refreshSessions,
      }}
    >
      {children}
    </DeviceSessionsContext.Provider>
  );
}

export function useDeviceSessions() {
  const context = useContext(DeviceSessionsContext);
  if (context === undefined) {
    throw new Error("useDeviceSessions must be used within a DeviceSessionsProvider");
  }
  return context;
}
