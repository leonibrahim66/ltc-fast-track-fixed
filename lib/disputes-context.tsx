import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { StorageEventBus, STORAGE_KEYS } from "@/lib/storage-event-bus";

export type DisputeStatus = "open" | "investigating" | "resolved" | "rejected";
export type DisputeType = 
  | "missed_pickup" 
  | "incomplete_pickup" 
  | "damaged_property" 
  | "rude_behavior" 
  | "wrong_charges" 
  | "other";
export type ResolutionType = "refund" | "re_pickup" | "credit" | "apology" | "no_action";

export interface Dispute {
  id: string;
  pickupId: string;
  userId: string;
  userName: string;
  userPhone: string;
  collectorId?: string;
  collectorName?: string;
  type: DisputeType;
  description: string;
  photoEvidence?: string[];
  status: DisputeStatus;
  resolution?: ResolutionType;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

interface DisputesContextType {
  disputes: Dispute[];
  userDisputes: Dispute[];
  isLoading: boolean;
  createDispute: (dispute: Omit<Dispute, "id" | "createdAt" | "updatedAt" | "status">) => Promise<Dispute>;
  updateDispute: (id: string, updates: Partial<Dispute>) => Promise<void>;
  getDisputeById: (id: string) => Dispute | undefined;
  getDisputesByPickupId: (pickupId: string) => Dispute[];
  getDisputesByUserId: (userId: string) => Dispute[];
  refreshDisputes: () => Promise<void>;
}

const DisputesContext = createContext<DisputesContextType | undefined>(undefined);

const STORAGE_KEY = STORAGE_KEYS.DISPUTES;

export const DISPUTE_TYPES: Record<DisputeType, { label: string; icon: string; description: string }> = {
  missed_pickup: {
    label: "Missed Pickup",
    icon: "event-busy",
    description: "Collector did not arrive for scheduled pickup",
  },
  incomplete_pickup: {
    label: "Incomplete Pickup",
    icon: "warning",
    description: "Not all garbage was collected",
  },
  damaged_property: {
    label: "Damaged Property",
    icon: "broken-image",
    description: "Property was damaged during collection",
  },
  rude_behavior: {
    label: "Rude Behavior",
    icon: "sentiment-very-dissatisfied",
    description: "Unprofessional conduct by collector",
  },
  wrong_charges: {
    label: "Wrong Charges",
    icon: "money-off",
    description: "Incorrect payment amount charged",
  },
  other: {
    label: "Other Issue",
    icon: "help-outline",
    description: "Other issues not listed above",
  },
};

export const RESOLUTION_TYPES: Record<ResolutionType, { label: string; icon: string }> = {
  refund: { label: "Full Refund", icon: "payments" },
  re_pickup: { label: "Re-Pickup Scheduled", icon: "replay" },
  credit: { label: "Account Credit", icon: "card-giftcard" },
  apology: { label: "Apology Issued", icon: "sentiment-satisfied" },
  no_action: { label: "No Action Required", icon: "block" },
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, { label: string; color: string }> = {
  open: { label: "Open", color: "#F59E0B" },
  investigating: { label: "Investigating", color: "#3B82F6" },
  resolved: { label: "Resolved", color: "#22C55E" },
  rejected: { label: "Rejected", color: "#EF4444" },
};

export function DisputesProvider({ children }: { children: React.ReactNode }) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDisputes = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setDisputes(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load disputes:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  // Real-time: reload when another context writes to this key
  useEffect(() => {
    return StorageEventBus.subscribe(STORAGE_KEY, loadDisputes);
  }, [loadDisputes]);

  // Cross-device: reload when app returns to foreground
  useEffect(() => {
    let appStateRef: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.match(/inactive|background/) && next === "active") loadDisputes();
      appStateRef = next;
    });
    return () => sub.remove();
  }, [loadDisputes]);

  const saveDisputes = async (newDisputes: Dispute[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDisputes));
      setDisputes(newDisputes);
      StorageEventBus.emit(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to save disputes:", error);
    }
  };

  const createDispute = useCallback(async (
    disputeData: Omit<Dispute, "id" | "createdAt" | "updatedAt" | "status">
  ): Promise<Dispute> => {
    const now = new Date().toISOString();
    const newDispute: Dispute = {
      ...disputeData,
      id: `dispute_${Date.now()}`,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const current: Dispute[] = stored ? JSON.parse(stored) : [];
    await saveDisputes([newDispute, ...current]);
    return newDispute;
  }, []);

  const updateDispute = useCallback(async (id: string, updates: Partial<Dispute>) => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const current: Dispute[] = stored ? JSON.parse(stored) : [];
    const updatedDisputes = current.map((d) =>
      d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
    );
    await saveDisputes(updatedDisputes);
  }, []);

  const getDisputeById = useCallback((id: string) => {
    return disputes.find((d) => d.id === id);
  }, [disputes]);

  const getDisputesByPickupId = useCallback((pickupId: string) => {
    return disputes.filter((d) => d.pickupId === pickupId);
  }, [disputes]);

  const getDisputesByUserId = useCallback((userId: string) => {
    return disputes.filter((d) => d.userId === userId);
  }, [disputes]);

  const refreshDisputes = useCallback(async () => {
    setIsLoading(true);
    await loadDisputes();
  }, [loadDisputes]);

  // Derived state
  const userDisputes = disputes;

  return (
    <DisputesContext.Provider
      value={{
        disputes,
        userDisputes,
        isLoading,
        createDispute,
        updateDispute,
        getDisputeById,
        getDisputesByPickupId,
        getDisputesByUserId,
        refreshDisputes,
      }}
    >
      {children}
    </DisputesContext.Provider>
  );
}

export function useDisputes() {
  const context = useContext(DisputesContext);
  if (context === undefined) {
    throw new Error("useDisputes must be used within a DisputesProvider");
  }
  return context;
}
