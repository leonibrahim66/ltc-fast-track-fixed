import React, { createContext, useContext, useState, useCallback } from "react";

export interface SandboxPickup {
  id: string;
  address: string;
  status: "pending" | "accepted" | "completed";
  binType: string;
  scheduledDate: string;
}

export interface SandboxUser {
  id: string;
  name: string;
  email: string;
  role: "customer" | "collector";
  createdAt: string;
}

export interface SandboxPayment {
  id: string;
  amount: number;
  status: "pending" | "completed" | "failed";
  method: string;
  createdAt: string;
}

export interface SandboxContextType {
  sandboxEnabled: boolean;
  setSandboxEnabled: (enabled: boolean) => void;
  sandboxPickups: SandboxPickup[];
  sandboxUsers: SandboxUser[];
  sandboxPayments: SandboxPayment[];
  addSandboxPickup: (pickup: SandboxPickup) => void;
  addSandboxUser: (user: SandboxUser) => void;
  addSandboxPayment: (payment: SandboxPayment) => void;
  resetSandboxData: () => void;
  getSandboxStats: () => { pickups: number; users: number; payments: number };
}

const SandboxContext = createContext<SandboxContextType | undefined>(undefined);

const MOCK_PICKUPS: SandboxPickup[] = [
  {
    id: "sandbox-p1",
    address: "123 Test Street, Lusaka",
    status: "pending",
    binType: "standard",
    scheduledDate: new Date().toISOString(),
  },
  {
    id: "sandbox-p2",
    address: "456 Demo Avenue, Ndola",
    status: "accepted",
    binType: "large",
    scheduledDate: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: "sandbox-p3",
    address: "789 Sample Road, Kitwe",
    status: "completed",
    binType: "standard",
    scheduledDate: new Date(Date.now() - 86400000).toISOString(),
  },
];

const MOCK_USERS: SandboxUser[] = [
  {
    id: "sandbox-u1",
    name: "Test Customer",
    email: "customer@sandbox.test",
    role: "customer",
    createdAt: new Date().toISOString(),
  },
  {
    id: "sandbox-u2",
    name: "Test Collector",
    email: "collector@sandbox.test",
    role: "collector",
    createdAt: new Date().toISOString(),
  },
];

const MOCK_PAYMENTS: SandboxPayment[] = [
  {
    id: "sandbox-pay1",
    amount: 50000,
    status: "completed",
    method: "mobile_money",
    createdAt: new Date().toISOString(),
  },
  {
    id: "sandbox-pay2",
    amount: 75000,
    status: "pending",
    method: "bank_transfer",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const [sandboxEnabled, setSandboxEnabled] = useState(false);
  const [sandboxPickups, setSandboxPickups] = useState<SandboxPickup[]>(MOCK_PICKUPS);
  const [sandboxUsers, setSandboxUsers] = useState<SandboxUser[]>(MOCK_USERS);
  const [sandboxPayments, setSandboxPayments] = useState<SandboxPayment[]>(MOCK_PAYMENTS);

  const addSandboxPickup = useCallback((pickup: SandboxPickup) => {
    setSandboxPickups((prev) => [...prev, pickup]);
  }, []);

  const addSandboxUser = useCallback((user: SandboxUser) => {
    setSandboxUsers((prev) => [...prev, user]);
  }, []);

  const addSandboxPayment = useCallback((payment: SandboxPayment) => {
    setSandboxPayments((prev) => [...prev, payment]);
  }, []);

  const resetSandboxData = useCallback(() => {
    setSandboxPickups(MOCK_PICKUPS);
    setSandboxUsers(MOCK_USERS);
    setSandboxPayments(MOCK_PAYMENTS);
  }, []);

  const getSandboxStats = useCallback(() => {
    return {
      pickups: sandboxPickups.length,
      users: sandboxUsers.length,
      payments: sandboxPayments.length,
    };
  }, [sandboxPickups, sandboxUsers, sandboxPayments]);

  return (
    <SandboxContext.Provider
      value={{
        sandboxEnabled,
        setSandboxEnabled,
        sandboxPickups,
        sandboxUsers,
        sandboxPayments,
        addSandboxPickup,
        addSandboxUser,
        addSandboxPayment,
        resetSandboxData,
        getSandboxStats,
      }}
    >
      {children}
    </SandboxContext.Provider>
  );
}

export function useSandbox() {
  const context = useContext(SandboxContext);
  if (!context) {
    throw new Error("useSandbox must be used within SandboxProvider");
  }
  return context;
}
