/**
 * Pickups Context — Live Backend API
 *
 * All pickup data is fetched from / posted to the live backend:
 *   GET  /api/pickups  → load all pickups
 *   POST /api/pickups  → create a new pickup
 *
 * No AsyncStorage is used for pickup persistence.
 * The context keeps an in-memory cache that is refreshed:
 *   - on mount
 *   - when the app returns to foreground
 *   - when refreshPickups() is called explicitly
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { PickupStatus } from "@/constants/app";
import {
  fetchPickups as apiFetchPickups,
  createPickupOnServer,
  type ApiPickup,
  type CreatePickupPayload,
} from "@/lib/pickup-api";

// ─── Domain type ─────────────────────────────────────────────────────────────

export interface PickupRequest {
  id: string;
  userId: string;
  userPhone: string;
  userName: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  binType: "residential" | "commercial" | "industrial";
  photoUri?: string;
  notes?: string;
  status: PickupStatus;
  createdAt: string;
  assignedTo?: string;
  collectorId?: string;
  collectorName?: string;
  completedAt?: string;
  completionNotes?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  rating?: number;
  ratingComment?: string;
  completionPhotos?: string[];
  // Zone relationship
  zoneId?: string;
  zoneName?: string;
  // Driver assignment
  assignedDriverId?: string;
  assignedDriverName?: string;
  // Driver contact details
  driverPhone?: string;
  driverVehicleType?: string;
  // Waste type alias (maps to binType)
  wasteType?: string;
}

// Export type alias for convenience
export type Pickup = PickupRequest;

// ─── Adapter: ApiPickup → PickupRequest ──────────────────────────────────────

function toPickupRequest(api: ApiPickup): PickupRequest {
  // The backend stores location as a free-text string; we keep it in address
  // and set lat/lng to 0 unless the record carries numeric fields in the future.
  const binType = (api.wasteType as PickupRequest["binType"]) ?? "residential";
  return {
    id: api.id,
    userId: api.userId ?? "",
    userPhone: api.phoneNumber ?? "",
    userName: "",
    location: {
      latitude: 0,
      longitude: 0,
      address: api.location,
    },
    binType,
    wasteType: api.wasteType,
    notes: api.notes,
    status: "pending" as PickupStatus,
    createdAt: api.createdAt,
  };
}

// ─── Context interface ────────────────────────────────────────────────────────

interface PickupsContextType {
  pickups: PickupRequest[];
  userPickups: PickupRequest[];
  pendingPickups: PickupRequest[];
  isLoading: boolean;
  error: string | null;
  createPickup: (
    pickup: Omit<PickupRequest, "id" | "createdAt" | "status">
  ) => Promise<PickupRequest>;
  /** Local-only update — used for rating, completion notes, etc. */
  updatePickup: (id: string, updates: Partial<PickupRequest>) => Promise<void>;
  updatePickupStatus: (id: string, status: PickupStatus) => Promise<void>;
  getPickupById: (id: string) => PickupRequest | undefined;
  refreshPickups: () => Promise<void>;
}

const PickupsContext = createContext<PickupsContextType | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function PickupsProvider({ children }: { children: React.ReactNode }) {
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPickups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiPickups = await apiFetchPickups();
      setPickups(apiPickups.map(toPickupRequest));
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load pickups";
      setError(msg);
      console.error("[PickupsContext] loadPickups error:", msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPickups();
  }, [loadPickups]);

  // Reload when app returns to foreground
  useEffect(() => {
    let appStateRef: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.match(/inactive|background/) && next === "active") {
        loadPickups();
      }
      appStateRef = next;
    });
    return () => sub.remove();
  }, [loadPickups]);

  // ── createPickup ────────────────────────────────────────────────────────────
  const createPickup = useCallback(
    async (
      pickupData: Omit<PickupRequest, "id" | "createdAt" | "status">
    ): Promise<PickupRequest> => {
      const payload: CreatePickupPayload = {
        userId: pickupData.userId,
        location: pickupData.location.address ?? "",
        wasteType: pickupData.binType,
        notes: pickupData.notes,
        userName: pickupData.userName,
        userPhone: pickupData.userPhone,
        latitude: pickupData.location.latitude,
        longitude: pickupData.location.longitude,
        zoneId: pickupData.zoneId,
        scheduledDate: pickupData.scheduledDate,
        scheduledTime: pickupData.scheduledTime,
      };

      const apiResult = await createPickupOnServer(payload);

      // Build the full PickupRequest from the server response + local data
      const newPickup: PickupRequest = {
        ...pickupData,
        id: apiResult.id,
        status: "pending",
        createdAt: apiResult.createdAt,
      };

      // Optimistically prepend to in-memory list
      setPickups((prev) => [newPickup, ...prev]);

      // Refresh from server to ensure consistency
      loadPickups().catch(() => {});

      return newPickup;
    },
    [loadPickups]
  );

  // ── updatePickup (local-only — for ratings, completion notes, etc.) ─────────
  const updatePickup = useCallback(
    async (id: string, updates: Partial<PickupRequest>) => {
      setPickups((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    },
    []
  );

  const updatePickupStatus = useCallback(
    async (id: string, status: PickupStatus) => {
      const updates: Partial<PickupRequest> = { status };
      if (status === "completed") {
        updates.completedAt = new Date().toISOString();
      }
      await updatePickup(id, updates);
    },
    [updatePickup]
  );

  const getPickupById = useCallback(
    (id: string) => pickups.find((p) => p.id === id),
    [pickups]
  );

  const refreshPickups = useCallback(async () => {
    await loadPickups();
  }, [loadPickups]);

  // Derived state
  const userPickups = pickups;
  const pendingPickups = pickups.filter(
    (p) => p.status === "pending" || p.status === "assigned"
  );

  return (
    <PickupsContext.Provider
      value={{
        pickups,
        userPickups,
        pendingPickups,
        isLoading,
        error,
        createPickup,
        updatePickup,
        updatePickupStatus,
        getPickupById,
        refreshPickups,
      }}
    >
      {children}
    </PickupsContext.Provider>
  );
}

export function usePickups() {
  const context = useContext(PickupsContext);
  if (context === undefined) {
    throw new Error("usePickups must be used within a PickupsProvider");
  }
  return context;
}
