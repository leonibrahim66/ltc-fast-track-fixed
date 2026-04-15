import React, { createContext, useContext, useState, useCallback } from "react";
import { apiGet } from "@/lib/api-client";

export interface LinkedAccount {
  id: string;
  phoneNumber: string;
  provider: string;
  isActive: boolean;
  createdAt: string;
}

export interface WalletData {
  totalBalance: number;
  rechargedBalance: number;
  referralBalance: number;
  linkedAccount: LinkedAccount | null;
  lastUpdated: string;
}

interface WalletContextType {
  wallet: WalletData | null;
  userId: string | null;
  isLoading: boolean;
  error: string | null;
  setWallet: (wallet: WalletData) => void;
  setUserId: (userId: string) => void;
  refreshWallet: (userId: string) => Promise<void>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWallet = useCallback(
    async (id: string) => {
      if (!id) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch wallet balance via central api-client (uses EXPO_PUBLIC_API_URL)
        const walletData = await apiGet<{
          data?: { balance?: number; rechargedBalance?: number; referralBalance?: number };
        }>(`/api/wallet/${id}`);

        // Fetch linked account — non-fatal if missing
        let linkedAccount: LinkedAccount | null = null;
        try {
          const linkedData = await apiGet<{ data?: LinkedAccount }>(
            `/api/linked-accounts/${id}`
          );
          linkedAccount = linkedData.data ?? null;
        } catch {
          // linked account is optional — swallow the error
        }

        setWallet({
          totalBalance: walletData.data?.balance ?? 0,
          rechargedBalance: walletData.data?.rechargedBalance ?? 0,
          referralBalance: walletData.data?.referralBalance ?? 0,
          linkedAccount,
          lastUpdated: new Date().toISOString(),
        });

        setUserId(id);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to refresh wallet";
        setError(message);
        console.error("[wallet-context] refresh error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: WalletContextType = {
    wallet,
    userId,
    isLoading,
    error,
    setWallet,
    setUserId,
    refreshWallet,
    clearError,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
