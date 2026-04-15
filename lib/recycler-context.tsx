import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RecyclerOrder {
  id: string;
  recyclerId: string;
  recyclerName: string;
  recyclerPhone: string;
  category: string;
  categoryName: string;
  quantity: number;
  unit: string;
  totalPrice: number;
  deliveryAddress: string;
  notes?: string;
  status: "pending" | "confirmed" | "processing" | "delivered" | "cancelled";
  paymentStatus: "pending" | "paid" | "failed";
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

interface RecyclerContextType {
  orders: RecyclerOrder[];
  isLoading: boolean;
  createOrder: (orderData: Omit<RecyclerOrder, "id" | "status" | "paymentStatus" | "createdAt" | "updatedAt">) => Promise<RecyclerOrder>;
  updateOrderStatus: (orderId: string, status: RecyclerOrder["status"]) => Promise<void>;
  updatePaymentStatus: (orderId: string, paymentStatus: RecyclerOrder["paymentStatus"], paymentMethod?: string) => Promise<void>;
  getOrdersByRecycler: (recyclerId: string) => RecyclerOrder[];
  refreshOrders: () => Promise<void>;
}

const RecyclerContext = createContext<RecyclerContextType | undefined>(undefined);

const STORAGE_KEY = "@ltc_recycler_orders";

export function RecyclerProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<RecyclerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setOrders(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading recycler orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveOrders = async (newOrders: RecyclerOrder[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newOrders));
      setOrders(newOrders);
    } catch (error) {
      console.error("Error saving recycler orders:", error);
    }
  };

  const createOrder = async (
    orderData: Omit<RecyclerOrder, "id" | "status" | "paymentStatus" | "createdAt" | "updatedAt">
  ): Promise<RecyclerOrder> => {
    const newOrder: RecyclerOrder = {
      ...orderData,
      id: `RO-${Date.now()}`,
      status: "pending",
      paymentStatus: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newOrders = [newOrder, ...orders];
    await saveOrders(newOrders);
    return newOrder;
  };

  const updateOrderStatus = async (orderId: string, status: RecyclerOrder["status"]) => {
    const newOrders = orders.map((order) =>
      order.id === orderId
        ? { ...order, status, updatedAt: new Date().toISOString() }
        : order
    );
    await saveOrders(newOrders);
  };

  const updatePaymentStatus = async (
    orderId: string,
    paymentStatus: RecyclerOrder["paymentStatus"],
    paymentMethod?: string
  ) => {
    const newOrders = orders.map((order) =>
      order.id === orderId
        ? {
            ...order,
            paymentStatus,
            paymentMethod: paymentMethod || order.paymentMethod,
            updatedAt: new Date().toISOString(),
          }
        : order
    );
    await saveOrders(newOrders);
  };

  const getOrdersByRecycler = (recyclerId: string): RecyclerOrder[] => {
    return orders.filter((order) => order.recyclerId === recyclerId);
  };

  const refreshOrders = async () => {
    setIsLoading(true);
    await loadOrders();
  };

  return (
    <RecyclerContext.Provider
      value={{
        orders,
        isLoading,
        createOrder,
        updateOrderStatus,
        updatePaymentStatus,
        getOrdersByRecycler,
        refreshOrders,
      }}
    >
      {children}
    </RecyclerContext.Provider>
  );
}

export function useRecycler() {
  const context = useContext(RecyclerContext);
  if (context === undefined) {
    throw new Error("useRecycler must be used within a RecyclerProvider");
  }
  return context;
}
