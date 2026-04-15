import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { StorageEventBus, STORAGE_KEYS } from "@/lib/storage-event-bus";

export type PaymentStatus = "pending" | "confirmed" | "failed" | "cancelled";
export type PaymentMethod = "mtn" | "airtel" | "zamtel" | "bank";

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  methodName: string;
  status: PaymentStatus;
  transactionId?: string;
  screenshotUri?: string;
  reference: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  adminNote?: string;
  rejectionReason?: string;
}

interface PaymentsContextType {
  payments: Payment[];
  isLoading: boolean;
  createPayment: (payment: Omit<Payment, "id" | "createdAt" | "updatedAt">) => Promise<Payment>;
  updatePayment: (id: string, updates: Partial<Payment>) => Promise<void>;
  confirmPayment: (id: string, transactionId?: string, screenshotUri?: string) => Promise<void>;
  getPaymentsByUser: (userId: string) => Payment[];
  getPaymentById: (id: string) => Payment | undefined;
  getPendingPayments: (userId: string) => Payment[];
  // Admin functions
  getAllPendingPayments: () => Payment[];
  approvePayment: (id: string, adminNote?: string) => Promise<void>;
  rejectPayment: (id: string, reason: string) => Promise<void>;
}

const PaymentsContext = createContext<PaymentsContextType | undefined>(undefined);

const STORAGE_KEY = STORAGE_KEYS.PAYMENTS;

export function PaymentsProvider({ children }: { children: React.ReactNode }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPayments = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPayments(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load payments:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Real-time: reload when another context/screen writes to this key
  useEffect(() => {
    return StorageEventBus.subscribe(STORAGE_KEY, loadPayments);
  }, [loadPayments]);

  // Cross-device: reload when app returns to foreground
  useEffect(() => {
    let appStateRef: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.match(/inactive|background/) && next === "active") {
        loadPayments();
      }
      appStateRef = next;
    });
    return () => sub.remove();
  }, [loadPayments]);

  const savePayments = async (newPayments: Payment[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPayments));
      setPayments(newPayments);
      // Notify all subscribers (admin panels, user dashboards)
      StorageEventBus.emit(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to save payments:", error);
    }
  };

  const generateId = () => {
    return `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  };

  const generateReference = () => {
    return `LTC${Date.now().toString(36).toUpperCase()}`;
  };

  const createPayment = useCallback(async (
    paymentData: Omit<Payment, "id" | "createdAt" | "updatedAt">
  ): Promise<Payment> => {
    const now = new Date().toISOString();
    const newPayment: Payment = {
      ...paymentData,
      id: generateId(),
      reference: paymentData.reference || generateReference(),
      createdAt: now,
      updatedAt: now,
    };
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const current: Payment[] = stored ? JSON.parse(stored) : [];
    const updatedPayments = [newPayment, ...current];
    await savePayments(updatedPayments);
    return newPayment;
  }, []);

  const updatePayment = useCallback(async (id: string, updates: Partial<Payment>) => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const current: Payment[] = stored ? JSON.parse(stored) : [];
    const updatedPayments = current.map((payment) =>
      payment.id === id
        ? { ...payment, ...updates, updatedAt: new Date().toISOString() }
        : payment
    );
    await savePayments(updatedPayments);
  }, []);

  const confirmPayment = useCallback(async (
    id: string,
    transactionId?: string,
    screenshotUri?: string
  ) => {
    const now = new Date().toISOString();
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const current: Payment[] = stored ? JSON.parse(stored) : [];
    const updatedPayments = current.map((payment) =>
      payment.id === id
        ? {
            ...payment,
            status: "pending" as PaymentStatus, // Still pending until admin confirms
            transactionId: transactionId || payment.transactionId,
            screenshotUri: screenshotUri || payment.screenshotUri,
            updatedAt: now,
          }
        : payment
    );
    await savePayments(updatedPayments);
  }, []);

  const getPaymentsByUser = useCallback((userId: string): Payment[] => {
    return payments
      .filter((p) => p.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [payments]);

  const getPaymentById = useCallback((id: string): Payment | undefined => {
    return payments.find((p) => p.id === id);
  }, [payments]);

  const getPendingPayments = useCallback((userId: string): Payment[] => {
    return payments
      .filter((p) => p.userId === userId && p.status === "pending")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [payments]);

  // Admin: Get all pending payments across all users
  const getAllPendingPayments = useCallback((): Payment[] => {
    return payments
      .filter((p) => p.status === "pending")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [payments]);

  // Admin: Approve a payment
  const approvePayment = useCallback(async (id: string, adminNote?: string) => {
    const now = new Date().toISOString();
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const current: Payment[] = stored ? JSON.parse(stored) : [];
    const updatedPayments = current.map((payment) =>
      payment.id === id
        ? {
            ...payment,
            status: "confirmed" as PaymentStatus,
            confirmedAt: now,
            updatedAt: now,
            adminNote,
          }
        : payment
    );
    await savePayments(updatedPayments);
  }, []);

  // Admin: Reject a payment
  const rejectPayment = useCallback(async (id: string, reason: string) => {
    const now = new Date().toISOString();
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const current: Payment[] = stored ? JSON.parse(stored) : [];
    const updatedPayments = current.map((payment) =>
      payment.id === id
        ? {
            ...payment,
            status: "failed" as PaymentStatus,
            updatedAt: now,
            rejectionReason: reason,
          }
        : payment
    );
    await savePayments(updatedPayments);
  }, []);

  return (
    <PaymentsContext.Provider
      value={{
        payments,
        isLoading,
        createPayment,
        updatePayment,
        confirmPayment,
        getPaymentsByUser,
        getPaymentById,
        getPendingPayments,
        getAllPendingPayments,
        approvePayment,
        rejectPayment,
      }}
    >
      {children}
    </PaymentsContext.Provider>
  );
}

export function usePayments() {
  const context = useContext(PaymentsContext);
  if (!context) {
    throw new Error("usePayments must be used within a PaymentsProvider");
  }
  return context;
}
