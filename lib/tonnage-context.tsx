/**
 * Tonnage Context
 * Manages waste_tonnage_records with full CRUD operations.
 * Used by: Zone Managers, Garbage Drivers, Council Admin, Admin Panel.
 *
 * Storage key: @ltc_waste_tonnage_records
 * Financial access: NONE — no commission, no payment, no wallet data
 */
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type WasteType =
  | "general"
  | "recyclable"
  | "organic"
  | "hazardous"
  | "construction"
  | "medical"
  | "electronic";

export interface WasteTonnageRecord {
  id: string;
  zoneId: string;
  zoneName: string;
  driverId?: string;
  driverName?: string;
  pickupId?: string;
  wasteType: WasteType;
  estimatedWeight: number; // kg
  recordedWeight?: number; // kg — actual weighed value
  province: string;
  city: string;
  area?: string;
  notes?: string;
  recordedBy: string;
  recordedByRole: "zone_manager" | "garbage_driver" | "council_admin" | "admin";
  vehicleType?: string;
  vehiclePlate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TonnageSummary {
  totalRecords: number;
  totalEstimatedKg: number;
  totalRecordedKg: number;
  byWasteType: Record<WasteType, number>;
  byZone: Record<string, { zoneName: string; totalKg: number; recordCount: number }>;
  byMonth: Record<string, number>;
  byArea: Record<string, number>;
}

const STORAGE_KEY = "@ltc_waste_tonnage_records";

interface TonnageContextType {
  records: WasteTonnageRecord[];
  isLoading: boolean;
  loadRecords: () => Promise<void>;
  addRecord: (record: Omit<WasteTonnageRecord, "id" | "createdAt">) => Promise<WasteTonnageRecord>;
  updateRecord: (id: string, updates: Partial<WasteTonnageRecord>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  getSummary: (filters?: {
    province?: string;
    city?: string;
    zoneId?: string;
    startDate?: string;
    endDate?: string;
  }) => TonnageSummary;
  getRecordsByScope: (province: string, city?: string, zoneId?: string) => WasteTonnageRecord[];
  getMonthlyTotals: (province: string, city?: string, months?: number) => { month: string; totalKg: number; recordCount: number }[];
}

const TonnageContext = createContext<TonnageContextType | undefined>(undefined);

export function TonnageProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<WasteTonnageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: WasteTonnageRecord[] = JSON.parse(raw);
        setRecords(parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    } catch (e) {
      console.error("TonnageContext load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveRecords = async (updated: WasteTonnageRecord[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setRecords(updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const addRecord = useCallback(async (record: Omit<WasteTonnageRecord, "id" | "createdAt">): Promise<WasteTonnageRecord> => {
    const newRecord: WasteTonnageRecord = {
      ...record,
      id: `ton_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const existing: WasteTonnageRecord[] = raw ? JSON.parse(raw) : [];
    await saveRecords([newRecord, ...existing]);
    return newRecord;
  }, []);

  const updateRecord = useCallback(async (id: string, updates: Partial<WasteTonnageRecord>) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const existing: WasteTonnageRecord[] = raw ? JSON.parse(raw) : [];
    const updated = existing.map((r) =>
      r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
    );
    await saveRecords(updated);
  }, []);

  const deleteRecord = useCallback(async (id: string) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const existing: WasteTonnageRecord[] = raw ? JSON.parse(raw) : [];
    await saveRecords(existing.filter((r) => r.id !== id));
  }, []);

  const getRecordsByScope = useCallback(
    (province: string, city?: string, zoneId?: string): WasteTonnageRecord[] => {
      return records.filter((r) => {
        if (r.province !== province) return false;
        if (city && r.city !== city) return false;
        if (zoneId && r.zoneId !== zoneId) return false;
        return true;
      });
    },
    [records]
  );

  const getSummary = useCallback(
    (filters?: { province?: string; city?: string; zoneId?: string; startDate?: string; endDate?: string }): TonnageSummary => {
      let scoped = records;
      if (filters?.province) scoped = scoped.filter((r) => r.province === filters.province);
      if (filters?.city) scoped = scoped.filter((r) => r.city === filters.city);
      if (filters?.zoneId) scoped = scoped.filter((r) => r.zoneId === filters.zoneId);
      if (filters?.startDate) scoped = scoped.filter((r) => r.createdAt >= filters.startDate!);
      if (filters?.endDate) scoped = scoped.filter((r) => r.createdAt <= filters.endDate!);

      const byWasteType = {} as Record<WasteType, number>;
      const byZone: Record<string, { zoneName: string; totalKg: number; recordCount: number }> = {};
      const byMonth: Record<string, number> = {};
      const byArea: Record<string, number> = {};

      let totalEstimatedKg = 0;
      let totalRecordedKg = 0;

      scoped.forEach((r) => {
        const kg = r.recordedWeight ?? r.estimatedWeight;
        totalEstimatedKg += r.estimatedWeight;
        totalRecordedKg += r.recordedWeight ?? 0;

        byWasteType[r.wasteType] = (byWasteType[r.wasteType] || 0) + kg;

        if (!byZone[r.zoneId]) byZone[r.zoneId] = { zoneName: r.zoneName, totalKg: 0, recordCount: 0 };
        byZone[r.zoneId].totalKg += kg;
        byZone[r.zoneId].recordCount += 1;

        const month = r.createdAt.slice(0, 7);
        byMonth[month] = (byMonth[month] || 0) + kg;

        if (r.area) byArea[r.area] = (byArea[r.area] || 0) + kg;
      });

      return { totalRecords: scoped.length, totalEstimatedKg, totalRecordedKg, byWasteType, byZone, byMonth, byArea };
    },
    [records]
  );

  const getMonthlyTotals = useCallback(
    (province: string, city?: string, months = 6): { month: string; totalKg: number; recordCount: number }[] => {
      const result: { month: string; totalKg: number; recordCount: number }[] = [];
      const now = new Date();
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = d.toISOString().slice(0, 7);
        const monthRecords = records.filter((r) => {
          if (r.province !== province) return false;
          if (city && r.city !== city) return false;
          return r.createdAt.startsWith(monthKey);
        });
        const totalKg = monthRecords.reduce((s, r) => s + (r.recordedWeight ?? r.estimatedWeight), 0);
        result.push({
          month: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          totalKg,
          recordCount: monthRecords.length,
        });
      }
      return result;
    },
    [records]
  );

  return (
    <TonnageContext.Provider
      value={{ records, isLoading, loadRecords, addRecord, updateRecord, deleteRecord, getSummary, getRecordsByScope, getMonthlyTotals }}
    >
      {children}
    </TonnageContext.Provider>
  );
}

export function useTonnage() {
  const ctx = useContext(TonnageContext);
  if (!ctx) throw new Error("useTonnage must be used within TonnageProvider");
  return ctx;
}

export const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  general: "General Waste",
  recyclable: "Recyclable",
  organic: "Organic / Food",
  hazardous: "Hazardous",
  construction: "Construction Debris",
  medical: "Medical Waste",
  electronic: "E-Waste",
};

export const WASTE_TYPE_COLORS: Record<WasteType, string> = {
  general: "#6B7280",
  recyclable: "#059669",
  organic: "#D97706",
  hazardous: "#DC2626",
  construction: "#7C3AED",
  medical: "#DB2777",
  electronic: "#0891B2",
};
