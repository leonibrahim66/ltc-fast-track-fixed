import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { StorageEventBus, STORAGE_KEYS as BUS_KEYS } from "@/lib/storage-event-bus";

// Admin role definitions with permissions
export type AdminRole = "superadmin" | "support" | "finance" | "operations" | "zonemanager" | "council_admin";

export interface AdminPermissions {
  dashboard: boolean;
  users: boolean;
  disputes: boolean;
  transactions: boolean;
  pickups: boolean;
  subscriptions: boolean;
  updates: boolean;
  notifications: boolean;
  performance: boolean;
  analytics: boolean;
  settings: boolean;
  manageAdmins: boolean;
  exportData: boolean;
  zoneManagement: boolean;
}

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  superadmin: {
    dashboard: true,
    users: true,
    disputes: true,
    transactions: true,
    pickups: true,
    subscriptions: true,
    updates: true,
    notifications: true,
    performance: true,
    analytics: true,
    settings: true,
    manageAdmins: true,
    exportData: true,
    zoneManagement: true,
  },
  support: {
    dashboard: true,
    users: true,
    disputes: true,
    transactions: false,
    pickups: true,
    subscriptions: true,
    updates: false,
    notifications: true,
    performance: true,
    analytics: false,
    settings: false,
    manageAdmins: false,
    exportData: false,
    zoneManagement: false,
  },
  finance: {
    dashboard: true,
    users: false,
    disputes: false,
    transactions: true,
    pickups: false,
    subscriptions: true,
    updates: false,
    notifications: true,
    performance: false,
    analytics: true,
    settings: false,
    manageAdmins: false,
    exportData: true,
    zoneManagement: false,
  },
  operations: {
    dashboard: true,
    users: true,
    disputes: true,
    transactions: false,
    pickups: true,
    subscriptions: false,
    updates: true,
    notifications: true,
    performance: true,
    analytics: false,
    settings: false,
    manageAdmins: false,
    exportData: false,
    zoneManagement: false,
  },
  zonemanager: {
    dashboard: true,
    users: false,
    disputes: false,
    transactions: false,
    pickups: false,
    subscriptions: false,
    updates: false,
    notifications: true,
    performance: false,
    analytics: false,
    settings: false,
    manageAdmins: false,
    exportData: false,
    zoneManagement: true,
  },
  council_admin: {
    dashboard: true,
    users: true,
    disputes: true,
    transactions: false,
    pickups: true,
    subscriptions: false,
    updates: false,
    notifications: true,
    performance: true,
    analytics: true,
    settings: false,
    manageAdmins: false,
    exportData: true,
    zoneManagement: true,
  },
};

// Admin credentials - in production, this would be server-side
const ADMIN_ACCOUNTS = [
  {
    username: "admin",
    password: "ltc@admin2026",
    pin: "1234",
    fullName: "System Administrator",
    role: "superadmin" as AdminRole,
  },
  {
    username: "support",
    password: "support@ltc2026",
    pin: "2345",
    fullName: "Support Team",
    role: "support" as AdminRole,
  },
  {
    username: "finance",
    password: "finance@ltc2026",
    pin: "3456",
    fullName: "Finance Department",
    role: "finance" as AdminRole,
  },
  {
    username: "operations",
    password: "ops@ltc2026",
    pin: "4567",
    fullName: "Operations Manager",
    role: "operations" as AdminRole,
  },
  {
    username: "zoneadmin",
    password: "zone@ltc2026",
    pin: "5678",
    fullName: "Zone Management",
    role: "zonemanager" as AdminRole,
  },
  // ─── Council Admin Accounts — All 10 Zambian Provinces ───────────────────────
  {
    username: "council_lusaka",
    password: "council@lusaka2026",
    pin: "6789",
    fullName: "Lusaka City Council",
    role: "council_admin" as AdminRole,
    province: "Lusaka",
    city: "Lusaka",
  },
  {
    username: "council_copperbelt",
    password: "council@copperbelt2026",
    pin: "7890",
    fullName: "Copperbelt Province Council",
    role: "council_admin" as AdminRole,
    province: "Copperbelt",
    city: "Kitwe",
  },
  {
    username: "council_southern",
    password: "council@southern2026",
    pin: "8901",
    fullName: "Southern Province Council",
    role: "council_admin" as AdminRole,
    province: "Southern",
    city: "Livingstone",
  },
  {
    username: "council_eastern",
    password: "council@eastern2026",
    pin: "9012",
    fullName: "Eastern Province Council",
    role: "council_admin" as AdminRole,
    province: "Eastern",
    city: "Chipata",
  },
  {
    username: "council_northern",
    password: "council@northern2026",
    pin: "0123",
    fullName: "Northern Province Council",
    role: "council_admin" as AdminRole,
    province: "Northern",
    city: "Kasama",
  },
  {
    username: "council_northwestern",
    password: "council@northwestern2026",
    pin: "1357",
    fullName: "North-Western Province Council",
    role: "council_admin" as AdminRole,
    province: "North-Western",
    city: "Solwezi",
  },
  {
    username: "council_western",
    password: "council@western2026",
    pin: "2468",
    fullName: "Western Province Council",
    role: "council_admin" as AdminRole,
    province: "Western",
    city: "Mongu",
  },
  {
    username: "council_central",
    password: "council@central2026",
    pin: "3579",
    fullName: "Central Province Council",
    role: "council_admin" as AdminRole,
    province: "Central",
    city: "Kabwe",
  },
  {
    username: "council_luapula",
    password: "council@luapula2026",
    pin: "4680",
    fullName: "Luapula Province Council",
    role: "council_admin" as AdminRole,
    province: "Luapula",
    city: "Mansa",
  },
  {
    username: "council_muchinga",
    password: "council@muchinga2026",
    pin: "5791",
    fullName: "Muchinga Province Council",
    role: "council_admin" as AdminRole,
    province: "Muchinga",
    city: "Chinsali",
  },
];

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  role: AdminRole;
  permissions: AdminPermissions;
  lastLogin: string;
  // Council Admin geographic scope
  province?: string;
  city?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalCollectors: number;
  totalRecyclers: number;
  totalCustomers: number;
  totalResidential: number;
  totalCommercial: number;
  activePickups: number;
  completedPickups: number;
  pendingDisputes: number;
  totalRevenue: number;
  todayRevenue: number;
  newSubscriptions: number;
  expiringSubscriptions: number;
}

export interface AdminNotification {
  id: string;
  type: "subscription" | "dispute" | "payment" | "user" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

interface AdminContextType {
  adminUser: AdminUser | null;
  isAdminAuthenticated: boolean;
  isLoading: boolean;
  stats: AdminStats;
  notifications: AdminNotification[];
  unreadNotifications: number;
  loginAdmin: (username: string, password: string) => Promise<boolean>;
  loginWithPin: (pin: string) => Promise<boolean>;
  logoutAdmin: () => Promise<void>;
  refreshStats: () => Promise<void>;
  addNotification: (notification: Omit<AdminNotification, "id" | "read" | "createdAt">) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  clearNotification: (id: string) => Promise<void>;
  hasPermission: (permission: keyof AdminPermissions) => boolean;
  getRoleLabel: (role: AdminRole) => string;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const ADMIN_STORAGE_KEYS = {
  ADMIN_USER: "@ltc_admin_user",
  ADMIN_NOTIFICATIONS: "@ltc_admin_notifications",
};

const DEFAULT_STATS: AdminStats = {
  totalUsers: 0,
  totalCollectors: 0,
  totalRecyclers: 0,
  totalCustomers: 0,
  totalResidential: 0,
  totalCommercial: 0,
  activePickups: 0,
  completedPickups: 0,
  pendingDisputes: 0,
  totalRevenue: 0,
  todayRevenue: 0,
  newSubscriptions: 0,
  expiringSubscriptions: 0,
};

export function AdminProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>(DEFAULT_STATS);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  const isAdminAuthenticated = !!adminUser;
  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const loadAdminSession = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_USER);
      if (stored) {
        setAdminUser(JSON.parse(stored));
      }
      const storedNotifications = await AsyncStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_NOTIFICATIONS);
      if (storedNotifications) {
        setNotifications(JSON.parse(storedNotifications));
      }
    } catch (error) {
      console.error("Failed to load admin session:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveAdminSession = async (user: AdminUser | null) => {
    try {
      if (user) {
        await AsyncStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_USER, JSON.stringify(user));
      } else {
        await AsyncStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_USER);
      }
    } catch (error) {
      console.error("Failed to save admin session:", error);
    }
  };

  const saveNotifications = async (notifs: AdminNotification[]) => {
    try {
      await AsyncStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_NOTIFICATIONS, JSON.stringify(notifs));
    } catch (error) {
      console.error("Failed to save admin notifications:", error);
    }
  };

  const loginAdmin = useCallback(async (username: string, password: string): Promise<boolean> => {
    // Check credentials against all admin accounts
    const account = ADMIN_ACCOUNTS.find(
      (acc) => acc.username === username && acc.password === password
    );
    if (account) {
      const admin: AdminUser = {
        id: `admin_${account.username}`,
        username: account.username,
        fullName: account.fullName,
        role: account.role,
        permissions: ROLE_PERMISSIONS[account.role],
        lastLogin: new Date().toISOString(),
        province: (account as any).province,
        city: (account as any).city,
      };
      setAdminUser(admin);
      await saveAdminSession(admin);
      return true;
    }
    return false;
  }, []);

  const loginWithPin = useCallback(async (pin: string): Promise<boolean> => {
    const account = ADMIN_ACCOUNTS.find((acc) => acc.pin === pin);
    if (account) {
      const admin: AdminUser = {
        id: `admin_${account.username}`,
        username: account.username,
        fullName: account.fullName,
        role: account.role,
        permissions: ROLE_PERMISSIONS[account.role],
        lastLogin: new Date().toISOString(),
        province: (account as any).province,
        city: (account as any).city,
      };
      setAdminUser(admin);
      await saveAdminSession(admin);
      return true;
    }
    return false;
  }, []);

  const logoutAdmin = useCallback(async () => {
    setAdminUser(null);
    await saveAdminSession(null);
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      // Load data from various storage keys to calculate stats
      const usersDb = await AsyncStorage.getItem(BUS_KEYS.USERS_DB);
      const pickupsData = await AsyncStorage.getItem(BUS_KEYS.PICKUPS);
      const disputesData = await AsyncStorage.getItem(BUS_KEYS.DISPUTES);
      const paymentsData = await AsyncStorage.getItem(BUS_KEYS.PAYMENTS);

      let users: any[] = [];
      let pickups: any[] = [];
      let disputes: any[] = [];
      let payments: any[] = [];

      if (usersDb) {
        const parsed = JSON.parse(usersDb);
        users = Object.values(parsed);
      }
      if (pickupsData) pickups = JSON.parse(pickupsData);
      if (disputesData) disputes = JSON.parse(disputesData);
      if (paymentsData) payments = JSON.parse(paymentsData);

      const collectors = users.filter((u: any) => u.role === "collector" || u.role === "zone_manager");
      const recyclers = users.filter((u: any) => u.role === "recycler");
      const customers = users.filter((u: any) => u.role === "residential" || u.role === "commercial");
      const residentialUsers = users.filter((u: any) => u.role === "residential");
      const commercialUsers = users.filter((u: any) => u.role === "commercial");

      const activePickups = pickups.filter((p: any) => p.status === "pending" || p.status === "assigned" || p.status === "in_progress");
      const completedPickups = pickups.filter((p: any) => p.status === "completed");
      const pendingDisputes = disputes.filter((d: any) => d.status === "open" || d.status === "investigating");

      const totalRevenue = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const today = new Date().toDateString();
      const todayPayments = payments.filter((p: any) => new Date(p.createdAt).toDateString() === today);
      const todayRevenue = todayPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      // Count subscriptions
      const usersWithSubscription = customers.filter((u: any) => u.subscription);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const expiringSubscriptions = usersWithSubscription.filter((u: any) => {
        const expiresAt = new Date(u.subscription?.expiresAt);
        return expiresAt <= thirtyDaysFromNow;
      });

      setStats({
        totalUsers: users.length,
        totalCollectors: collectors.length,
        totalRecyclers: recyclers.length,
        totalCustomers: customers.length,
        totalResidential: residentialUsers.length,
        totalCommercial: commercialUsers.length,
        activePickups: activePickups.length,
        completedPickups: completedPickups.length,
        pendingDisputes: pendingDisputes.length,
        totalRevenue,
        todayRevenue,
        newSubscriptions: usersWithSubscription.length,
        expiringSubscriptions: expiringSubscriptions.length,
      });
    } catch (error) {
      console.error("Failed to refresh stats:", error);
    }
  }, []);

  // Load admin session on mount
  useEffect(() => {
    loadAdminSession();
  }, [loadAdminSession]);

  // Real-time: auto-refresh stats whenever any key data changes
  useEffect(() => {
    const keys = [
      BUS_KEYS.USERS_DB,
      BUS_KEYS.PICKUPS,
      BUS_KEYS.PAYMENTS,
      BUS_KEYS.DISPUTES,
      BUS_KEYS.SUBSCRIPTION_REQUESTS,
      BUS_KEYS.WITHDRAWALS,
    ];
    const unsubs = keys.map((key) => StorageEventBus.subscribe(key, refreshStats));
    return () => unsubs.forEach((u) => u());
  }, [refreshStats]);

  // Cross-device: refresh stats when app returns to foreground
  useEffect(() => {
    let appStateRef: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.match(/inactive|background/) && next === "active") {
        loadAdminSession();
        refreshStats();
      }
      appStateRef = next;
    });
    return () => sub.remove();
  }, [loadAdminSession, refreshStats]);

  const addNotification = useCallback(async (
    notificationData: Omit<AdminNotification, "id" | "read" | "createdAt">
  ) => {
    const newNotification: AdminNotification = {
      ...notificationData,
      id: `ADMIN_NOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [newNotification, ...notifications];
    setNotifications(updated);
    await saveNotifications(updated);
  }, [notifications]);

  const markNotificationRead = useCallback(async (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    await saveNotifications(updated);
  }, [notifications]);

  const markAllNotificationsRead = useCallback(async () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    await saveNotifications(updated);
  }, [notifications]);

  const clearNotification = useCallback(async (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    await saveNotifications(updated);
  }, [notifications]);

  const hasPermission = useCallback((permission: keyof AdminPermissions): boolean => {
    if (!adminUser) return false;
    return adminUser.permissions[permission] === true;
  }, [adminUser]);

  const getRoleLabel = useCallback((role: AdminRole): string => {
    const labels: Record<AdminRole, string> = {
      superadmin: "Super Administrator",
      support: "Support Team",
      finance: "Finance Department",
      operations: "Operations Manager",
      zonemanager: "Zone Management",
      council_admin: "Council Administrator",
    };
    return labels[role] || role;
  }, []);

  return (
    <AdminContext.Provider
      value={{
        adminUser,
        isAdminAuthenticated,
        isLoading,
        stats,
        notifications,
        unreadNotifications,
        loginAdmin,
        loginWithPin,
        logoutAdmin,
        refreshStats,
        addNotification,
        markNotificationRead,
        markAllNotificationsRead,
        clearNotification,
        hasPermission,
        getRoleLabel,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
