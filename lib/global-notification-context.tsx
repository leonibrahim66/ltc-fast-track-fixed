/**
 * lib/global-notification-context.tsx
 *
 * Global real-time notification system for LTC Fast Track.
 *
 * Architecture:
 * - Reads from Supabase `user_notifications` table directly (NOT the tRPC stub)
 * - Subscribes to Supabase Realtime for instant INSERT/UPDATE events
 * - Falls back to 15-second polling when Realtime is unavailable
 * - Exposes unreadCount for bell badge across all role dashboards
 * - Queues in-app banner toasts for new notifications
 * - Works for all user roles: customer, driver, zone manager, admin
 *
 * Why Supabase directly (not tRPC):
 * - The tRPC layer is a stub that always returns null — it was never connected
 * - Supabase is the actual database; all writes go there via sendNotification()
 * - Supabase Realtime gives sub-second push updates without polling
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
export type GlobalNotifType =
  | "pickup_update"
  | "driver_accepted"
  | "driver_arriving"
  | "pickup_completed"
  | "payment"
  | "subscription"
  | "system"
  | "support";

export interface GlobalNotification {
  id: number;
  userId: string;
  type: GlobalNotifType;
  title: string;
  /** The notification body/message */
  body: string;
  isRead: boolean;
  data?: Record<string, unknown> | null;
  pickupId?: string | null;
  createdAt: string;
}

export interface BannerNotification {
  id: number;
  type: GlobalNotifType;
  title: string;
  body: string;
}

interface GlobalNotificationContextType {
  notifications: GlobalNotification[];
  unreadCount: number;
  isLoading: boolean;
  bannerQueue: BannerNotification[];
  dismissBanner: () => void;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const GlobalNotificationContext = createContext<
  GlobalNotificationContextType | undefined
>(undefined);

// ─── Constants ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 15_000;
const MAX_NOTIFICATIONS = 100;

// ─── Row shape from Supabase ──────────────────────────────────────────────────
interface SupabaseNotifRow {
  id: number;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read_status: boolean;
  data: Record<string, unknown> | null;
  pickup_id: string | null;
  created_at: string;
}

function rowToNotification(row: SupabaseNotifRow): GlobalNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: (row.type as GlobalNotifType) ?? "system",
    title: row.title ?? "",
    body: row.message ?? "",
    isRead: row.read_status ?? false,
    data: row.data,
    pickupId: row.pickup_id,
    createdAt: row.created_at,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function GlobalNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const userId: string | null = (user as any)?.id ?? null;

  const [notifications, setNotifications] = useState<GlobalNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [bannerQueue, setBannerQueue] = useState<BannerNotification[]>([]);

  // Track IDs we've already shown a banner for (prevents re-showing on re-fetch)
  const shownBannerIds = useRef<Set<number>>(new Set());
  // Track the timestamp of the last fetch so we only banner truly new items
  const lastFetchAt = useRef<Date>(new Date());
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ─── Fetch from Supabase ──────────────────────────────────────────────────
  const fetchFromSupabase = useCallback(
    async (showBanners = false): Promise<void> => {
      if (!userId) return;
      if (!isSupabaseConfigured()) {
        console.warn("[GlobalNotif] Supabase not configured — notifications unavailable");
        return;
      }
      try {
        const { data, error } = await supabase
          .from("user_notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(MAX_NOTIFICATIONS);

        if (error) {
          console.warn("[GlobalNotif] Fetch error:", error.message);
          return;
        }

        const rows = (data ?? []) as SupabaseNotifRow[];
        const mapped = rows.map(rowToNotification);

        if (showBanners) {
          // Show banners for notifications created after the last fetch
          const cutoff = lastFetchAt.current;
          for (const n of mapped) {
            if (!n.isRead && !shownBannerIds.current.has(n.id)) {
              const createdAt = new Date(n.createdAt);
              if (createdAt > cutoff) {
                shownBannerIds.current.add(n.id);
                setBannerQueue((prev) => [
                  ...prev,
                  { id: n.id, type: n.type, title: n.title, body: n.body },
                ]);
              }
            }
          }
        }

        lastFetchAt.current = new Date();
        setNotifications(mapped);
      } catch (err) {
        console.warn("[GlobalNotif] Unexpected error:", err);
      }
    },
    [userId]
  );

  // ─── Initial load ─────────────────────────────────────────────────────────
  const loadInitial = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    // Set lastFetchAt to now so we don't banner old notifications on first load
    lastFetchAt.current = new Date();
    await fetchFromSupabase(false);
    setIsLoading(false);
  }, [userId, fetchFromSupabase]);

  // ─── Supabase Realtime subscription ──────────────────────────────────────
  const subscribeRealtime = useCallback(() => {
    if (!userId || !isSupabaseConfigured()) return;

    // Clean up any existing channel
    if (realtimeChannel.current) {
      supabase.removeChannel(realtimeChannel.current);
      realtimeChannel.current = null;
    }

    const channel = supabase
      .channel(`user_notifications:${userId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            const newRow = payload.new as SupabaseNotifRow;
            const newNotif = rowToNotification(newRow);
            setNotifications((prev) => {
              // Avoid duplicates
              if (prev.some((n) => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
            // Show banner for new unread notifications
            if (!newNotif.isRead && !shownBannerIds.current.has(newNotif.id)) {
              shownBannerIds.current.add(newNotif.id);
              setBannerQueue((prev) => [
                ...prev,
                {
                  id: newNotif.id,
                  type: newNotif.type,
                  title: newNotif.title,
                  body: newNotif.body,
                },
              ]);
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedRow = payload.new as SupabaseNotifRow;
            const updatedNotif = rowToNotification(updatedRow);
            setNotifications((prev) =>
              prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
            );
          }
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log("[GlobalNotif] Realtime subscribed for user:", userId);
        } else if (status === "CHANNEL_ERROR") {
          console.warn("[GlobalNotif] Realtime channel error — falling back to polling");
        }
      });

    realtimeChannel.current = channel;
  }, [userId]);

  // ─── Polling fallback ─────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => {
      fetchFromSupabase(true);
    }, POLL_INTERVAL_MS);
  }, [fetchFromSupabase]);

  // ─── App state: refresh when app comes to foreground ─────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        fetchFromSupabase(true);
      }
    });
    return () => sub.remove();
  }, [fetchFromSupabase]);

  // ─── Bootstrap when user changes ─────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setBannerQueue([]);
      shownBannerIds.current.clear();
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }

    loadInitial();
    subscribeRealtime();
    startPolling();

    return () => {
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [userId, loadInitial, subscribeRealtime, startPolling]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const markAsRead = useCallback(
    async (id: number) => {
      if (!isSupabaseConfigured()) return;
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_status: true })
        .eq("id", id);
      if (error) {
        console.warn("[GlobalNotif] markAsRead error:", error.message);
        // Revert on failure
        await fetchFromSupabase(false);
      }
    },
    [fetchFromSupabase]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) return;
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_status: true })
      .eq("user_id", userId)
      .eq("read_status", false);
    if (error) {
      console.warn("[GlobalNotif] markAllAsRead error:", error.message);
      await fetchFromSupabase(false);
    }
  }, [userId, fetchFromSupabase]);

  const dismissBanner = useCallback(() => {
    setBannerQueue((prev) => prev.slice(1));
  }, []);

  const refresh = useCallback(async () => {
    await fetchFromSupabase(true);
  }, [fetchFromSupabase]);

  // ─── Derived values ───────────────────────────────────────────────────────
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <GlobalNotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        bannerQueue,
        dismissBanner,
        markAsRead,
        markAllAsRead,
        refresh,
      }}
    >
      {children}
    </GlobalNotificationContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useGlobalNotifications(): GlobalNotificationContextType {
  const ctx = useContext(GlobalNotificationContext);
  if (!ctx) {
    throw new Error(
      "useGlobalNotifications must be used inside GlobalNotificationProvider"
    );
  }
  return ctx;
}
