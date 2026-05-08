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

const GlobalNotificationContext =
  createContext<GlobalNotificationContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 15000;
const MAX_NOTIFICATIONS = 100;

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

  const shownBannerIds = useRef<Set<number>>(new Set());
  const lastFetchAt = useRef<Date>(new Date());
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeChannel = useRef<any>(null);
  const realtimeConnected = useRef(false);
  const fetchInFlight = useRef(false);
  const realtimeFallbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const fetchFromSupabase = useCallback(
    async (showBanners = false): Promise<void> => {
      if (fetchInFlight.current) return;
      if (!userId) return;
      if (!isSupabaseConfigured()) return;

      fetchInFlight.current = true;

      try {
        const { data, error } = await supabase
          .from("user_notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(MAX_NOTIFICATIONS);

        if (error) return;

        const rows = (data ?? []) as SupabaseNotifRow[];
        const mapped = rows.map(rowToNotification);

        if (showBanners) {
          const cutoff = lastFetchAt.current;

          for (const n of mapped) {
            if (!n.isRead && !shownBannerIds.current.has(n.id)) {
              if (new Date(n.createdAt) > cutoff) {
                shownBannerIds.current.add(n.id);
                setBannerQueue((prev) => [
                  ...prev,
                  {
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    body: n.body,
                  },
                ]);
              }
            }
          }
        }

        lastFetchAt.current = new Date();

        setNotifications((prev) => {
          const same =
            prev.length === mapped.length &&
            prev.every(
              (p, i) =>
                p.id === mapped[i].id &&
                p.isRead === mapped[i].isRead &&
                p.title === mapped[i].title &&
                p.body === mapped[i].body
            );

          return same ? prev : mapped;
        });
      } catch (err) {
        console.log("[GlobalNotif] fetch failed", err);
      } finally {
        fetchInFlight.current = false;
      }
    },
    [userId]
  );

  const startPolling = useCallback(() => {
    stopPolling();

    pollTimer.current = setInterval(() => {
      fetchFromSupabase(true);
    }, POLL_INTERVAL_MS);
  }, [fetchFromSupabase]);

  const loadInitial = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    lastFetchAt.current = new Date();
    await fetchFromSupabase(false);
    setIsLoading(false);
  }, [userId, fetchFromSupabase]);

  const subscribeRealtime = useCallback(() => {
    if (!userId || !isSupabaseConfigured()) {
      startPolling();
      return;
    }

    if (realtimeChannel.current) {
      supabase.removeChannel(realtimeChannel.current);
      realtimeChannel.current = null;
    }

    realtimeConnected.current = false;

    const channel = supabase
      .channel(`user_notifications_${userId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const newRow = payload.new as SupabaseNotifRow;
          if (!newRow) return;

          const notif = rowToNotification(newRow);

          setNotifications((prev) => {
            const exists = prev.find((n) => n.id === notif.id);
            if (exists) {
              return prev.map((n) => (n.id === notif.id ? notif : n));
            }
            return [notif, ...prev];
          });

          if (!notif.isRead && !shownBannerIds.current.has(notif.id)) {
            shownBannerIds.current.add(notif.id);
            setBannerQueue((prev) => [
              ...prev,
              {
                id: notif.id,
                type: notif.type,
                title: notif.title,
                body: notif.body,
              },
            ]);
          }
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          realtimeConnected.current = true;
          stopPolling();
          console.log("[GlobalNotif] Realtime active");
        }
      });

    realtimeChannel.current = channel;

    if (realtimeFallbackTimeout.current) {
      clearTimeout(realtimeFallbackTimeout.current);
      realtimeFallbackTimeout.current = null;
    }

    realtimeFallbackTimeout.current = setTimeout(() => {
      if (!realtimeConnected.current) {
        startPolling();
      }
    }, 5000);
  }, [userId, startPolling]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        fetchFromSupabase(true);
      }
    });

    return () => sub.remove();
  }, [fetchFromSupabase]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setBannerQueue([]);
      shownBannerIds.current.clear();
      stopPolling();

      if (realtimeFallbackTimeout.current) {
        clearTimeout(realtimeFallbackTimeout.current);
        realtimeFallbackTimeout.current = null;
      }

      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }

      return;
    }

    loadInitial();
    subscribeRealtime();

    return () => {
      stopPolling();

      if (realtimeFallbackTimeout.current) {
        clearTimeout(realtimeFallbackTimeout.current);
        realtimeFallbackTimeout.current = null;
      }

      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }
    };
  }, [userId, loadInitial, subscribeRealtime]);

  const markAsRead = useCallback(async (id: number) => {
    if (!isSupabaseConfigured()) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    await supabase
      .from("user_notifications")
      .update({ read_status: true })
      .eq("id", id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    await supabase
      .from("user_notifications")
      .update({ read_status: true })
      .eq("user_id", userId)
      .eq("read_status", false);
  }, [userId]);

  const dismissBanner = useCallback(() => {
    setBannerQueue((prev) => prev.slice(1));
  }, []);

  const refresh = useCallback(async () => {
    await fetchFromSupabase(true);
  }, [fetchFromSupabase]);

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

export function useGlobalNotifications(): GlobalNotificationContextType {
  const ctx = useContext(GlobalNotificationContext);

  if (!ctx) {
    throw new Error("useGlobalNotifications must be used inside GlobalNotificationProvider");
  }

  return ctx;
}