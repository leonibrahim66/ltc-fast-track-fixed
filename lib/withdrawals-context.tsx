import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { StorageEventBus, STORAGE_KEYS } from "@/lib/storage-event-bus";

export type WithdrawalStatus = "pending" | "approved" | "paid" | "rejected";
export type WithdrawalMethod = "mtn" | "airtel" | "bank";

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  method: WithdrawalMethod;
  accountNumber: string;
  accountName?: string;
  bankName?: string;
  status: WithdrawalStatus;
  reference: string;
  createdAt: string;
  processedAt?: string;
  rejectionReason?: string;
}

export interface AutoWithdrawalSettings {
  enabled: boolean;
  threshold: number;
  frequency: "weekly" | "monthly";
  method: WithdrawalMethod;
  accountNumber: string;
  accountName?: string;
  bankName?: string;
}

interface WithdrawalsContextType {
  withdrawals: Withdrawal[];
  autoSettings: AutoWithdrawalSettings | null;
  createWithdrawal: (withdrawal: Omit<Withdrawal, "id" | "reference" | "createdAt" | "status">) => Promise<Withdrawal>;
  updateWithdrawalStatus: (id: string, status: WithdrawalStatus, reason?: string) => Promise<void>;
  getWithdrawalsByUser: (userId: string) => Withdrawal[];
  saveAutoSettings: (settings: AutoWithdrawalSettings) => Promise<void>;
  clearAutoSettings: () => Promise<void>;
}

const WithdrawalsContext = createContext<WithdrawalsContextType | undefined>(undefined);

const STORAGE_KEY = STORAGE_KEYS.WITHDRAWALS;
const AUTO_SETTINGS_KEY = "ltc_auto_withdrawal";

export function WithdrawalsProvider({ children }: { children: ReactNode }) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [autoSettings, setAutoSettings] = useState<AutoWithdrawalSettings | null>(null);

  const loadWithdrawals = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setWithdrawals(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load withdrawals:", error);
    }
  }, []);

  useEffect(() => {
    loadWithdrawals();
    loadAutoSettings();
  }, [loadWithdrawals]);

  // Real-time: reload when another context writes to this key
  useEffect(() => {
    return StorageEventBus.subscribe(STORAGE_KEY, loadWithdrawals);
  }, [loadWithdrawals]);

  // Cross-device: reload when app returns to foreground
  useEffect(() => {
    let appStateRef: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.match(/inactive|background/) && next === "active") loadWithdrawals();
      appStateRef = next;
    });
    return () => sub.remove();
  }, [loadWithdrawals]);

  const loadAutoSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTO_SETTINGS_KEY);
      if (stored) {
        setAutoSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load auto settings:", error);
    }
  };

  const saveWithdrawals = async (newWithdrawals: Withdrawal[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newWithdrawals));
      setWithdrawals(newWithdrawals);
      StorageEventBus.emit(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to save withdrawals:", error);
    }
  };

  const createWithdrawal = async (
    withdrawalData: Omit<Withdrawal, "id" | "reference" | "createdAt" | "status">
  ): Promise<Withdrawal> => {
    const newWithdrawal: Withdrawal = {
      ...withdrawalData,
      id: `WD-${Date.now()}`,
      reference: `WD${Date.now().toString(36).toUpperCase()}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const current: Withdrawal[] = stored ? JSON.parse(stored) : [];
    await saveWithdrawals([newWithdrawal, ...current]);
    return newWithdrawal;
  };

  const updateWithdrawalStatus = async (
    id: string,
    status: WithdrawalStatus,
    reason?: string
  ) => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const current: Withdrawal[] = stored ? JSON.parse(stored) : [];
    const updated = current.map((w) =>
      w.id === id
        ? {
            ...w,
            status,
            processedAt: new Date().toISOString(),
            rejectionReason: reason,
          }
        : w
    );
    await saveWithdrawals(updated);
  };

  const getWithdrawalsByUser = (userId: string) => {
    return withdrawals.filter((w) => w.userId === userId);
  };

  const saveAutoSettings = async (settings: AutoWithdrawalSettings) => {
    try {
      await AsyncStorage.setItem(AUTO_SETTINGS_KEY, JSON.stringify(settings));
      setAutoSettings(settings);
    } catch (error) {
      console.error("Failed to save auto settings:", error);
    }
  };

  const clearAutoSettings = async () => {
    try {
      await AsyncStorage.removeItem(AUTO_SETTINGS_KEY);
      setAutoSettings(null);
    } catch (error) {
      console.error("Failed to clear auto settings:", error);
    }
  };

  return (
    <WithdrawalsContext.Provider
      value={{
        withdrawals,
        autoSettings,
        createWithdrawal,
        updateWithdrawalStatus,
        getWithdrawalsByUser,
        saveAutoSettings,
        clearAutoSettings,
      }}
    >
      {children}
    </WithdrawalsContext.Provider>
  );
}

export function useWithdrawals() {
  const context = useContext(WithdrawalsContext);
  if (!context) {
    throw new Error("useWithdrawals must be used within a WithdrawalsProvider");
  }
  return context;
}
