import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type UpdateType = "feature" | "announcement" | "promotion" | "maintenance" | "tip";

export interface FeaturedUpdate {
  id: string;
  type: UpdateType;
  title: string;
  message: string;
  icon: string;
  color: string;
  actionLabel?: string;
  actionRoute?: string;
  priority: number; // Higher = more important
  startDate: string;
  endDate?: string;
  dismissible: boolean;
  targetRoles?: string[]; // If empty, show to all
  createdAt: string;
}

interface FeaturedUpdatesContextType {
  updates: FeaturedUpdate[];
  activeUpdates: FeaturedUpdate[];
  dismissedIds: string[];
  isLoading: boolean;
  dismissUpdate: (id: string) => Promise<void>;
  resetDismissed: () => Promise<void>;
  getUpdatesForRole: (role: string) => FeaturedUpdate[];
  // Admin functions
  createUpdate: (data: Omit<FeaturedUpdate, "id" | "createdAt">) => Promise<FeaturedUpdate>;
  updateUpdate: (id: string, data: Partial<FeaturedUpdate>) => Promise<void>;
  deleteUpdate: (id: string) => Promise<void>;
  refreshUpdates: () => Promise<void>;
}

const FeaturedUpdatesContext = createContext<FeaturedUpdatesContextType | undefined>(undefined);

const DISMISSED_KEY = "ltc_dismissed_updates";
const CUSTOM_UPDATES_KEY = "ltc_custom_updates";

// Default featured updates - these would typically come from a backend
const DEFAULT_UPDATES: FeaturedUpdate[] = [
  {
    id: "update_leaderboard_2026",
    type: "feature",
    title: "New: Collector Leaderboard",
    message: "See top-performing collectors ranked by pickups and ratings. Check out who's leading this week!",
    icon: "emoji-events",
    color: "#F59E0B",
    actionLabel: "View Leaderboard",
    actionRoute: "/leaderboard",
    priority: 100,
    startDate: "2026-01-01",
    dismissible: true,
    createdAt: "2026-01-06T00:00:00Z",
  },
  {
    id: "update_disputes_2026",
    type: "feature",
    title: "Report Pickup Issues",
    message: "Had a problem with your pickup? You can now report issues directly from completed pickups and track resolution status.",
    icon: "gavel",
    color: "#EF4444",
    actionLabel: "Learn More",
    actionRoute: "/dispute-history",
    priority: 95,
    startDate: "2026-01-01",
    targetRoles: ["residential", "commercial"],
    dismissible: true,
    createdAt: "2026-01-06T00:00:00Z",
  },
  {
    id: "update_welcome_2026",
    type: "announcement",
    title: "Welcome to LTC FAST TRACK!",
    message: "Thank you for joining us. We're committed to providing fast and efficient garbage collection services across Zambia.",
    icon: "celebration",
    color: "#22C55E",
    priority: 90,
    startDate: "2026-01-01",
    dismissible: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "tip_schedule_pickup",
    type: "tip",
    title: "Pro Tip: Schedule Pickups",
    message: "You can schedule pickups in advance for specific dates and times. Never miss a collection again!",
    icon: "lightbulb",
    color: "#3B82F6",
    actionLabel: "Schedule Now",
    actionRoute: "/request-pickup",
    priority: 80,
    startDate: "2026-01-01",
    targetRoles: ["residential", "commercial"],
    dismissible: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "promo_referral_2026",
    type: "promotion",
    title: "Refer Friends, Earn K50!",
    message: "Share your referral code with friends and earn K50 credit for each successful signup.",
    icon: "card-giftcard",
    color: "#8B5CF6",
    actionLabel: "Start Referring",
    actionRoute: "/referrals",
    priority: 75,
    startDate: "2026-01-01",
    targetRoles: ["residential", "commercial"],
    dismissible: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "collector_earnings_tip",
    type: "tip",
    title: "Track Your Earnings",
    message: "View your daily, weekly, and monthly earnings in the Collector Dashboard. Keep track of your performance!",
    icon: "account-balance-wallet",
    color: "#22C55E",
    actionLabel: "View Earnings",
    actionRoute: "/collector-earnings",
    priority: 85,
    startDate: "2026-01-01",
    targetRoles: ["collector"],
    dismissible: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "recycler_orders_tip",
    type: "tip",
    title: "Manage Your Orders",
    message: "Track incoming recyclable materials and manage your inventory from the Recycler Dashboard.",
    icon: "recycling",
    color: "#22C55E",
    actionLabel: "View Dashboard",
    actionRoute: "/recycler-dashboard",
    priority: 85,
    startDate: "2026-01-01",
    targetRoles: ["recycler"],
    dismissible: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
];

export const UPDATE_TYPE_LABELS: Record<UpdateType, { label: string; icon: string }> = {
  feature: { label: "New Feature", icon: "new-releases" },
  announcement: { label: "Announcement", icon: "campaign" },
  promotion: { label: "Promotion", icon: "local-offer" },
  maintenance: { label: "Maintenance", icon: "build" },
  tip: { label: "Tip", icon: "lightbulb" },
};

export function FeaturedUpdatesProvider({ children }: { children: ReactNode }) {
  const [updates, setUpdates] = useState<FeaturedUpdate[]>(DEFAULT_UPDATES);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load dismissed IDs and custom updates from storage
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dismissedStored, customStored] = await Promise.all([
        AsyncStorage.getItem(DISMISSED_KEY),
        AsyncStorage.getItem(CUSTOM_UPDATES_KEY),
      ]);
      if (dismissedStored) {
        setDismissedIds(JSON.parse(dismissedStored));
      }
      if (customStored) {
        const customUpdates = JSON.parse(customStored);
        setUpdates([...customUpdates, ...DEFAULT_UPDATES]);
      }
    } catch (error) {
      console.error("Failed to load updates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDismissed = async (ids: string[]) => {
    try {
      await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
    } catch (error) {
      console.error("Failed to save dismissed updates:", error);
    }
  };

  const saveCustomUpdates = async (customUpdates: FeaturedUpdate[]) => {
    try {
      await AsyncStorage.setItem(CUSTOM_UPDATES_KEY, JSON.stringify(customUpdates));
    } catch (error) {
      console.error("Failed to save custom updates:", error);
    }
  };

  // Filter active updates (within date range and not dismissed)
  const activeUpdates = updates
    .filter((update) => {
      const now = new Date();
      const startDate = new Date(update.startDate);
      const endDate = update.endDate ? new Date(update.endDate) : null;

      const isWithinDateRange = now >= startDate && (!endDate || now <= endDate);
      const isNotDismissed = !dismissedIds.includes(update.id);

      return isWithinDateRange && isNotDismissed;
    })
    .sort((a, b) => b.priority - a.priority);

  const dismissUpdate = useCallback(async (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    await saveDismissed(newDismissed);
  }, [dismissedIds]);

  const resetDismissed = useCallback(async () => {
    setDismissedIds([]);
    await saveDismissed([]);
  }, []);

  const getUpdatesForRole = useCallback((role: string) => {
    return activeUpdates.filter((update) => {
      if (!update.targetRoles || update.targetRoles.length === 0) {
        return true; // Show to all if no target roles specified
      }
      return update.targetRoles.includes(role);
    });
  }, [activeUpdates]);

  const createUpdate = useCallback(async (
    data: Omit<FeaturedUpdate, "id" | "createdAt">
  ): Promise<FeaturedUpdate> => {
    const newUpdate: FeaturedUpdate = {
      ...data,
      id: `update_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const customUpdates = updates.filter((u) => !DEFAULT_UPDATES.some((d) => d.id === u.id));
    const newCustomUpdates = [newUpdate, ...customUpdates];
    await saveCustomUpdates(newCustomUpdates);
    setUpdates([...newCustomUpdates, ...DEFAULT_UPDATES]);
    return newUpdate;
  }, [updates]);

  const updateUpdate = useCallback(async (id: string, data: Partial<FeaturedUpdate>) => {
    const updatedUpdates = updates.map((u) =>
      u.id === id ? { ...u, ...data } : u
    );
    const customUpdates = updatedUpdates.filter((u) => !DEFAULT_UPDATES.some((d) => d.id === u.id));
    await saveCustomUpdates(customUpdates);
    setUpdates(updatedUpdates);
  }, [updates]);

  const deleteUpdate = useCallback(async (id: string) => {
    const filteredUpdates = updates.filter((u) => u.id !== id);
    const customUpdates = filteredUpdates.filter((u) => !DEFAULT_UPDATES.some((d) => d.id === u.id));
    await saveCustomUpdates(customUpdates);
    setUpdates(filteredUpdates);
  }, [updates]);

  const refreshUpdates = useCallback(async () => {
    await loadData();
  }, []);

  return (
    <FeaturedUpdatesContext.Provider
      value={{
        updates,
        activeUpdates,
        dismissedIds,
        isLoading,
        dismissUpdate,
        resetDismissed,
        getUpdatesForRole,
        createUpdate,
        updateUpdate,
        deleteUpdate,
        refreshUpdates,
      }}
    >
      {children}
    </FeaturedUpdatesContext.Provider>
  );
}

export function useFeaturedUpdates() {
  const context = useContext(FeaturedUpdatesContext);
  if (!context) {
    throw new Error("useFeaturedUpdates must be used within a FeaturedUpdatesProvider");
  }
  return context;
}
