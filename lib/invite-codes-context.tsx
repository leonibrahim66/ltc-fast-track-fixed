/**
 * Driver Invite Codes Context
 *
 * Manages the driver_invite_codes table (AsyncStorage-backed):
 *   id, code, zone_manager_id, zone_id, usage_limit, used_count,
 *   expires_at, created_at, is_active
 *
 * Zone scoping: managers only see/manage their own codes.
 * Admin: can read all codes filtered by zone_id.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const INVITE_CODES_STORAGE_KEY = "@ltc_driver_invite_codes";

export interface DriverInviteCode {
  id: string;
  code: string;
  zoneManagerId: string;
  zoneManagerName: string;
  zoneId: string | null;
  usageLimit: number | null; // null = unlimited
  usedCount: number;
  expiresAt: string | null; // ISO date string, null = no expiry
  createdAt: string;
  isActive: boolean;
}

export type InviteCodeStatus = "active" | "expired" | "disabled" | "exhausted";

export function getInviteCodeStatus(code: DriverInviteCode): InviteCodeStatus {
  if (!code.isActive) return "disabled";
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return "expired";
  if (code.usageLimit !== null && code.usedCount >= code.usageLimit) return "exhausted";
  return "active";
}

interface InviteCodesContextValue {
  codes: DriverInviteCode[];
  isLoading: boolean;
  loadCodes: () => Promise<void>;
  generateCode: (params: {
    zoneManagerId: string;
    zoneManagerName: string;
    zoneId: string | null;
    usageLimit: number | null;
    expiresAt: string | null;
  }) => Promise<DriverInviteCode>;
  disableCode: (id: string) => Promise<void>;
  deleteCode: (id: string) => Promise<void>;
  validateCode: (code: string) => Promise<{
    valid: boolean;
    inviteCode?: DriverInviteCode;
    error?: string;
  }>;
  consumeCode: (code: string) => Promise<DriverInviteCode | null>;
  getCodesByManager: (zoneManagerId: string) => DriverInviteCode[];
  getCodesByZone: (zoneId: string) => DriverInviteCode[];
}

const InviteCodesContext = createContext<InviteCodesContextValue | null>(null);

function generateRandomCode(length = 7): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // exclude confusable chars
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function InviteCodesProvider({ children }: { children: ReactNode }) {
  const [codes, setCodes] = useState<DriverInviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadCodes = useCallback(async () => {
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(INVITE_CODES_STORAGE_KEY);
      const stored: DriverInviteCode[] = raw ? JSON.parse(raw) : [];
      setCodes(stored);
    } catch (_e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveCodes = async (updated: DriverInviteCode[]) => {
    await AsyncStorage.setItem(INVITE_CODES_STORAGE_KEY, JSON.stringify(updated));
    setCodes(updated);
  };

  const generateCode = useCallback(
    async (params: {
      zoneManagerId: string;
      zoneManagerName: string;
      zoneId: string | null;
      usageLimit: number | null;
      expiresAt: string | null;
    }): Promise<DriverInviteCode> => {
      const raw = await AsyncStorage.getItem(INVITE_CODES_STORAGE_KEY);
      const existing: DriverInviteCode[] = raw ? JSON.parse(raw) : [];

      // Generate unique code
      let code = generateRandomCode(7);
      let attempts = 0;
      while (existing.some((c) => c.code === code) && attempts < 20) {
        code = generateRandomCode(7);
        attempts++;
      }

      const newCode: DriverInviteCode = {
        id: `ic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        code,
        zoneManagerId: params.zoneManagerId,
        zoneManagerName: params.zoneManagerName,
        zoneId: params.zoneId,
        usageLimit: params.usageLimit,
        usedCount: 0,
        expiresAt: params.expiresAt,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      const updated = [...existing, newCode];
      await saveCodes(updated);
      return newCode;
    },
    []
  );

  const disableCode = useCallback(async (id: string) => {
    const raw = await AsyncStorage.getItem(INVITE_CODES_STORAGE_KEY);
    const existing: DriverInviteCode[] = raw ? JSON.parse(raw) : [];
    const updated = existing.map((c) =>
      c.id === id ? { ...c, isActive: false } : c
    );
    await saveCodes(updated);
  }, []);

  const deleteCode = useCallback(async (id: string) => {
    const raw = await AsyncStorage.getItem(INVITE_CODES_STORAGE_KEY);
    const existing: DriverInviteCode[] = raw ? JSON.parse(raw) : [];
    const updated = existing.filter((c) => c.id !== id);
    await saveCodes(updated);
  }, []);

  const validateCode = useCallback(
    async (
      code: string
    ): Promise<{ valid: boolean; inviteCode?: DriverInviteCode; error?: string }> => {
      try {
        const raw = await AsyncStorage.getItem(INVITE_CODES_STORAGE_KEY);
        const existing: DriverInviteCode[] = raw ? JSON.parse(raw) : [];
        const found = existing.find(
          (c) => c.code === code.trim().toUpperCase()
        );

        if (!found) {
          return { valid: false, error: "Invalid invite code. Please ask your Zone Manager for a valid code." };
        }
        if (!found.isActive) {
          return { valid: false, error: "This invite code has been disabled by the Zone Manager." };
        }
        if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
          return { valid: false, error: "This invite code has expired. Please request a new one from your Zone Manager." };
        }
        if (found.usageLimit !== null && found.usedCount >= found.usageLimit) {
          return { valid: false, error: "This invite code has reached its usage limit. Please request a new one." };
        }

        return { valid: true, inviteCode: found };
      } catch (_e) {
        return { valid: false, error: "Failed to validate invite code. Please try again." };
      }
    },
    []
  );

  const consumeCode = useCallback(async (code: string): Promise<DriverInviteCode | null> => {
    const raw = await AsyncStorage.getItem(INVITE_CODES_STORAGE_KEY);
    const existing: DriverInviteCode[] = raw ? JSON.parse(raw) : [];
    const idx = existing.findIndex((c) => c.code === code.trim().toUpperCase());
    if (idx === -1) return null;

    existing[idx] = { ...existing[idx], usedCount: existing[idx].usedCount + 1 };
    await saveCodes(existing);
    return existing[idx];
  }, []);

  const getCodesByManager = useCallback(
    (zoneManagerId: string) => codes.filter((c) => c.zoneManagerId === zoneManagerId),
    [codes]
  );

  const getCodesByZone = useCallback(
    (zoneId: string) => codes.filter((c) => c.zoneId === zoneId),
    [codes]
  );

  return (
    <InviteCodesContext.Provider
      value={{
        codes,
        isLoading,
        loadCodes,
        generateCode,
        disableCode,
        deleteCode,
        validateCode,
        consumeCode,
        getCodesByManager,
        getCodesByZone,
      }}
    >
      {children}
    </InviteCodesContext.Provider>
  );
}

export function useInviteCodes() {
  const ctx = useContext(InviteCodesContext);
  if (!ctx) throw new Error("useInviteCodes must be used within InviteCodesProvider");
  return ctx;
}
