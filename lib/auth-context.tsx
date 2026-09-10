import { getOrCreateBackendUserId } from "@/lib/user-session";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { UserRole } from "@/constants/app";
import { StorageEventBus, STORAGE_KEYS as BUS_KEYS } from "@/lib/storage-event-bus";

export interface VehicleDetails {
  make: string;
  model?: string;
  year?: string;
  capacity?: string;
  color?: string;
  plateNumber: string;
}

export interface User {
  id: string;
  fullName: string;
  phone: string;
  password?: string;
  role: UserRole;
  location?: { latitude: number; longitude: number; address?: string };
  idNumber?: string;
  transportCategory?: string;
  vehicleRegistration?: string;
  vehicleDetails?: VehicleDetails;
  vehicleType?: string;
  plateNumber?: string;
  vehicleCapacity?: string;
  zone?: string;
  zoneId?: string;
  profilePicture?: string;
  availabilityStatus?: "online" | "offline" | "busy";
  collectorType?: "vehicle" | "foot";
  serviceRadius?: string;
  affiliationFeePaid?: boolean;
  affiliationFeeType?: string;
  affiliationFeePaidAt?: string;
  subscription?: {
    planId: string;
    planName: string;
    expiresAt: string;
    pickupsRemaining: number;
  };
  status?: "pending_review" | "active" | "rejected" | "suspended";
  kycStatus?: "pending" | "verified" | "rejected";
  townId?: string;
  selectedZoneId?: string;
  proposedZoneName?: string;
  firstName?: string;
  lastName?: string;
  province?: string;
  provinceId?: string;
  city?: string;
  cityId?: string;
  areaType?: "residential" | "commercial" | "industrial";
  areaName?: string;
  fullAddress?: string;
  assignedZoneId?: string;
  assignedZoneName?: string;
  zoneMatchStatus?: "matched" | "unassigned";
  nrcNumber?: string;
  driverLicenseNumber?: string;
  vehiclePlateNumber?: string;
  nrcDocumentUri?: string;
  zoneManagerId?: string;
  inviteCode?: string;
  driverStatus?: "pending_manager_approval" | "active" | "suspended" | "rejected";
  pickupsToday?: number;
  driverRating?: number;
  isOnline?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<boolean>;
  register: (userData: Partial<User> & { password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEYS = {
  USER: BUS_KEYS.USER,
  USERS_DB: BUS_KEYS.USERS_DB,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hydratedOnce = useRef(false);

  const loadUser = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);

      if (stored) {
        const userData = JSON.parse(stored);

        if (userData.role === "collector") {
          userData.role = "zone_manager";
          await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(userData));

          const usersDb = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USERS_DB);
          if (usersDb) {
            const users = JSON.parse(usersDb);
            if (users[userData.id]) {
              users[userData.id].role = "zone_manager";
              await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USERS_DB, JSON.stringify(users));
            }
          }
        }

        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("[AuthProvider] Failed to load user:", error);
      setUser(null);
    } finally {
      if (!hydratedOnce.current) {
        hydratedOnce.current = true;
        setIsLoading(false);
      }
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);

      if (!storedUser) {
        setUser(null);
        return null;
      }

      const currentUser: User = JSON.parse(storedUser);

      // Check USERS_DB for the latest approved subscription data.
      const usersDb = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USERS_DB);

      if (usersDb) {
        const users: Record<string, User & { password?: string }> =
          JSON.parse(usersDb);

        const latestUser = users[currentUser.id];

        if (latestUser) {
          const { password: _password, ...userWithoutPassword } = latestUser;

          setUser(userWithoutPassword);
          await AsyncStorage.setItem(
            AUTH_STORAGE_KEYS.USER,
            JSON.stringify(userWithoutPassword)
          );

          return userWithoutPassword;
        }
      }

      setUser(currentUser);
      return currentUser;
    } catch (error) {
      console.error("[AuthProvider] Failed to refresh user:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    return StorageEventBus.subscribe(AUTH_STORAGE_KEYS.USER, loadUser);
  }, [loadUser]);

  useEffect(() => {
    let appStateRef: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.match(/inactive|background/) && next === "active") {
        loadUser();
      }
      appStateRef = next;
    });
    return () => sub.remove();
  }, [loadUser]);

  const login = useCallback(async (phone: string, password: string): Promise<boolean> => {
    try {
      const usersDb = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USERS_DB);
      const users: Record<string, User & { password: string }> = usersDb ? JSON.parse(usersDb) : {};

      const foundUser = Object.values(users).find(
        (u) => u.phone === phone && u.password === password
      );

      if (!foundUser) return false;

      if (foundUser.role === "collector") {
        foundUser.role = "zone_manager" as any;
        users[foundUser.id] = foundUser;
        await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USERS_DB, JSON.stringify(users));
      }

      const { password: _, ...userWithoutPassword } = foundUser;
      setUser(userWithoutPassword);
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(userWithoutPassword));
      StorageEventBus.emit(AUTH_STORAGE_KEYS.USER);
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  }, []);

  const register = useCallback(async (userData: Partial<User> & { password: string }): Promise<boolean> => {
    try {
      const usersDb = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USERS_DB);
      const users: Record<string, User & { password: string }> = usersDb ? JSON.parse(usersDb) : {};

      //const phoneExists = Object.values(users).some((u) => u.phone === userData.phone);
      //if (phoneExists) return false;

      const backendUserId = await getOrCreateBackendUserId(userData.phone, {
        name: userData.fullName,
        country: userData.country,
        province: userData.province,
        city: userData.city,
        town: userData.town,
        fullAddress: userData.fullAddress,
      });

      const newUser: User & { password: string } = {
        id: backendUserId,
        fullName: userData.fullName || "",
        ...userData,
        zoneId: userData.zoneId ?? userData.assignedZoneId,
        driverRating: userData.driverRating ?? 0,
        pickupsToday: userData.pickupsToday ?? 0,
        isOnline: userData.isOnline ?? false,
        password: userData.password,
      };

      users[newUser.id] = newUser;
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USERS_DB, JSON.stringify(users));
      StorageEventBus.emit(AUTH_STORAGE_KEYS.USERS_DB);

      const { password: _, ...userWithoutPassword } = newUser;
      setUser(userWithoutPassword);
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(userWithoutPassword));
      StorageEventBus.emit(AUTH_STORAGE_KEYS.USER);

      return true;
    } catch (error) {
      console.error("Registration failed:", error);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER);
    setUser(null);
    StorageEventBus.emit(BUS_KEYS.LOGOUT);
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;

    try {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);

      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      StorageEventBus.emit(AUTH_STORAGE_KEYS.USER);

      const usersDb = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USERS_DB);
      if (usersDb) {
        const users = JSON.parse(usersDb);
        if (users[user.id]) {
          users[user.id] = { ...users[user.id], ...updates };
          await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USERS_DB, JSON.stringify(users));
          StorageEventBus.emit(AUTH_STORAGE_KEYS.USERS_DB);
        }
      }
    } catch (error) {
      console.error("Update user failed:", error);
    }
  }, [user]);

  return (
  <AuthContext.Provider
    value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      updateUser,
      refreshUser,
    }}
  >
    {children}
  </AuthContext.Provider>
 );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}