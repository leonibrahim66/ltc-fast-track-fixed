import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
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
  password?: string; // Stored locally for demo, in production use secure backend
  role: UserRole;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  // Collector specific fields
  idNumber?: string;
  transportCategory?: string;
  vehicleRegistration?: string;
  vehicleDetails?: VehicleDetails;
  vehicleType?: string;
  plateNumber?: string;
  vehicleCapacity?: string;
  zone?: string;
  zoneId?: string;
  // Profile picture
  profilePicture?: string;
  // Collector availability status
  availabilityStatus?: "online" | "offline" | "busy";
  // Foot collector fields
  collectorType?: "vehicle" | "foot";
  serviceRadius?: string;
  // Affiliation fee status
  affiliationFeePaid?: boolean;
  affiliationFeeType?: string;
  affiliationFeePaidAt?: string;
  // Subscription info
  subscription?: {
    planId: string;
    planName: string;
    expiresAt: string;
    pickupsRemaining: number;
  };
  // Zone Manager registration fields
  status?: "pending_review" | "active" | "rejected" | "suspended";
  kycStatus?: "pending" | "verified" | "rejected";
  townId?: string;
  selectedZoneId?: string;
  proposedZoneName?: string;
  firstName?: string;
  lastName?: string;
  // Customer location fields (province/city/zone matching)
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
  // Garbage Driver specific fields
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEYS = {
  USER: BUS_KEYS.USER,
  USERS_DB: BUS_KEYS.USERS_DB,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    // Hard timeout: if AsyncStorage takes more than 2 seconds (e.g. on fresh APK install
    // where native modules are still initializing), resolve immediately with no user.
    // This prevents the splash screen from freezing indefinitely.
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(() => {
        console.warn('[AuthProvider] loadUser timed out after 2s — proceeding without session');
        resolve();
      }, 2000)
    );

    const loadPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);
        if (stored) {
          const userData = JSON.parse(stored);
          // Migrate collector → zone_manager role
          if (userData.role === "collector") {
            userData.role = "zone_manager";
            await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(userData));
            // Also migrate in users DB
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
        }
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    })();

    // Race: whichever finishes first (load or timeout) unblocks the app
    await Promise.race([loadPromise, timeoutPromise]);
    setIsLoading(false);
  }, []);

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Real-time: reload when another context updates the user record
  useEffect(() => {
    return StorageEventBus.subscribe(AUTH_STORAGE_KEYS.USER, loadUser);
  }, [loadUser]);

  // Cross-device: reload when app returns to foreground
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
      // Get users database
      const usersDb = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USERS_DB);
      const users: Record<string, User & { password: string }> = usersDb ? JSON.parse(usersDb) : {};

      // Find user by phone
      const foundUser = Object.values(users).find(
        (u) => u.phone === phone && u.password === password
      );

      if (foundUser) {
        // Migrate collector → zone_manager on login
        if (foundUser.role === "collector") {
          foundUser.role = "zone_manager" as any;
          users[foundUser.id] = foundUser;
          await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USERS_DB, JSON.stringify(users));
        }
        const { password: _, ...userWithoutPassword } = foundUser;
        setUser(userWithoutPassword);
        await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(userWithoutPassword));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  }, []);

  const register = useCallback(async (userData: Partial<User> & { password: string }): Promise<boolean> => {
    try {
      // Get existing users
      const usersDb = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USERS_DB);
      const users: Record<string, User & { password: string }> = usersDb ? JSON.parse(usersDb) : {};

      // Check if phone already exists
      const phoneExists = Object.values(users).some((u) => u.phone === userData.phone);
      if (phoneExists) {
        return false;
      }

      // Create new user — preserve all fields including Zone Manager registration data
      const newUser: User & { password: string } = {
        id: `user_${Date.now()}`,
        fullName: userData.fullName || "",
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone || "",
        role: userData.role || "residential",
        status: userData.status,
        kycStatus: userData.kycStatus,
        townId: userData.townId,
        selectedZoneId: userData.selectedZoneId,
        proposedZoneName: userData.proposedZoneName,
        location: userData.location,
        idNumber: userData.idNumber,
        transportCategory: userData.transportCategory,
        vehicleRegistration: userData.vehicleRegistration,
        vehicleDetails: userData.vehicleDetails,
        // Customer location fields
        province: userData.province,
        provinceId: userData.provinceId,
        city: userData.city,
        cityId: userData.cityId,
        areaType: userData.areaType,
        areaName: userData.areaName,
        fullAddress: userData.fullAddress,
        assignedZoneId: userData.assignedZoneId,
        zoneId: userData.zoneId ?? userData.assignedZoneId,
        assignedZoneName: userData.assignedZoneName,
        zoneMatchStatus: userData.zoneMatchStatus,
        // Garbage Driver fields
        nrcNumber: userData.nrcNumber,
        driverLicenseNumber: userData.driverLicenseNumber,
        vehiclePlateNumber: userData.vehiclePlateNumber,
        nrcDocumentUri: userData.nrcDocumentUri,
        zoneManagerId: userData.zoneManagerId,
        inviteCode: userData.inviteCode,
        driverStatus: userData.driverStatus,
        driverRating: userData.driverRating ?? 0,
        pickupsToday: userData.pickupsToday ?? 0,
        isOnline: userData.isOnline ?? false,
        password: userData.password,
      };

      // Save to database
      users[newUser.id] = newUser;
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USERS_DB, JSON.stringify(users));
      // Notify admin panels that a new user registered
      StorageEventBus.emit(AUTH_STORAGE_KEYS.USERS_DB);

      // Log in the new user
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
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER);
      setUser(null);
      // Notify all layout guards to redirect to welcome screen immediately
      StorageEventBus.emit(BUS_KEYS.LOGOUT);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;

    try {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      StorageEventBus.emit(AUTH_STORAGE_KEYS.USER);

      // Also update in users database
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
