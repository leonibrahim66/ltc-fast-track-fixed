import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { StorageEventBus, STORAGE_KEYS as BUS_KEYS } from "@/lib/storage-event-bus";

const IT_REALTIME_KEY = "@ltc_it_realtime_data";

// Event types for real-time monitoring
export type ITEventType = 
  | "new_registration"
  | "subscription_new"
  | "subscription_renewed"
  | "subscription_expired"
  | "subscription_pending"
  | "pickup_pinned"
  | "pickup_accepted"
  | "pickup_completed"
  | "pickup_cancelled"
  | "payment_received"
  | "payment_pending"
  | "dispute_filed"
  | "collector_online"
  | "collector_offline"
  | "driver_approved"
  | "driver_rejected";

export interface ITRealtimeEvent {
  id: string;
  type: ITEventType;
  title: string;
  description: string;
  timestamp: string;
  data: {
    userId?: string;
    userName?: string;
    userRole?: string;
    phone?: string;
    amount?: number;
    planName?: string;
    pickupId?: string;
    location?: string;
    collectorId?: string;
    collectorName?: string;
    driverId?: string;
  };
  read: boolean;
  priority: "low" | "medium" | "high" | "critical";
}

export interface RecentRegistration {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  registeredAt: string;
  location?: string;
  verified: boolean;
}

export interface PendingSubscription {
  id: string;
  userId: string;
  userName: string;
  phone: string;
  planName: string;
  planPrice: number;
  requestedAt: string;
  paymentStatus: "pending" | "awaiting_verification";
}

export interface LivePickup {
  id: string;
  customerId: string;
  customerName: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  binType: string;
  status: "pending" | "accepted" | "in_progress" | "completed";
  collectorId?: string;
  collectorName?: string;
  pinnedAt: string;
  scheduledFor?: string;
}

export interface SubscriptionEvent {
  id: string;
  userId: string;
  userName: string;
  phone: string;
  planName: string;
  planPrice: number;
  eventType: "new" | "renewed" | "expired" | "cancelled";
  timestamp: string;
}

interface ITRealtimeContextType {
  // Events feed
  events: ITRealtimeEvent[];
  unreadCount: number;
  addEvent: (event: Omit<ITRealtimeEvent, "id" | "timestamp" | "read">) => void;
  markEventRead: (eventId: string) => void;
  markAllRead: () => void;
  clearEvents: () => void;
  
  // Recent registrations
  recentRegistrations: RecentRegistration[];
  addRegistration: (registration: Omit<RecentRegistration, "id" | "registeredAt">) => void;
  
  // Pending subscriptions
  pendingSubscriptions: PendingSubscription[];
  addPendingSubscription: (subscription: Omit<PendingSubscription, "id" | "requestedAt">) => void;
  removePendingSubscription: (subscriptionId: string) => void;
  
  // Live pickups
  livePickups: LivePickup[];
  addLivePickup: (pickup: Omit<LivePickup, "id" | "pinnedAt">) => void;
  updateLivePickup: (pickupId: string, updates: Partial<LivePickup>) => void;
  removeLivePickup: (pickupId: string) => void;
  
  // Subscription events
  subscriptionEvents: SubscriptionEvent[];
  addSubscriptionEvent: (event: Omit<SubscriptionEvent, "id" | "timestamp">) => void;
  
  // Stats
  stats: {
    totalRegistrationsToday: number;
    totalPickupsToday: number;
    activePickups: number;
    pendingPayments: number;
    onlineCollectors: number;
  };
  
  // Refresh
  refreshData: () => Promise<void>;
  isLoading: boolean;
}

const ITRealtimeContext = createContext<ITRealtimeContextType | undefined>(undefined);

export function ITRealtimeProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<ITRealtimeEvent[]>([]);
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistration[]>([]);
  const [pendingSubscriptions, setPendingSubscriptions] = useState<PendingSubscription[]>([]);
  const [livePickups, setLivePickups] = useState<LivePickup[]>([]);
  const [subscriptionEvents, setSubscriptionEvents] = useState<SubscriptionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadData();
    generateDemoData();
  }, []);

  // Real-time: reload when users register, subscriptions change, or pickups update
  useEffect(() => {
    const keys = [
      BUS_KEYS.USERS_DB,
      BUS_KEYS.PICKUPS,
      BUS_KEYS.SUBSCRIPTION_REQUESTS,
      BUS_KEYS.PAYMENTS,
    ];
    const unsubs = keys.map((key) => StorageEventBus.subscribe(key, loadData));
    return () => unsubs.forEach((u) => u());
  }, []);

  // Cross-device: reload when app returns to foreground
  useEffect(() => {
    let appStateRef: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.match(/inactive|background/) && next === "active") loadData();
      appStateRef = next;
    });
    return () => sub.remove();
  }, []);

  // Save data whenever it changes
  useEffect(() => {
    saveData();
  }, [events, recentRegistrations, pendingSubscriptions, livePickups, subscriptionEvents]);

  const loadData = async () => {
    try {
      const stored = await AsyncStorage.getItem(IT_REALTIME_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setEvents(data.events || []);
        setRecentRegistrations(data.recentRegistrations || []);
        setPendingSubscriptions(data.pendingSubscriptions || []);
        setLivePickups(data.livePickups || []);
        setSubscriptionEvents(data.subscriptionEvents || []);
      }
    } catch (error) {
      console.error("Error loading IT realtime data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem(
        IT_REALTIME_KEY,
        JSON.stringify({
          events,
          recentRegistrations,
          pendingSubscriptions,
          livePickups,
          subscriptionEvents,
        })
      );
    } catch (error) {
      console.error("Error saving IT realtime data:", error);
    }
  };

  const generateDemoData = () => {
    const now = new Date();
    
    // Demo recent registrations
    const demoRegistrations: RecentRegistration[] = [
      {
        id: "reg-1",
        fullName: "Mwamba Chanda",
        phone: "0971234567",
        role: "residential",
        registeredAt: new Date(now.getTime() - 5 * 60000).toISOString(),
        location: "Kabulonga, Lusaka",
        verified: true,
      },
      {
        id: "reg-2",
        fullName: "Grace Mutale",
        phone: "0962345678",
        role: "commercial",
        registeredAt: new Date(now.getTime() - 15 * 60000).toISOString(),
        location: "Cairo Road, Lusaka",
        verified: false,
      },
      {
        id: "reg-3",
        fullName: "Peter Banda",
        phone: "0953456789",
        role: "collector",
        registeredAt: new Date(now.getTime() - 30 * 60000).toISOString(),
        location: "Chilenje, Lusaka",
        verified: true,
      },
      {
        id: "reg-4",
        fullName: "Natasha Phiri",
        phone: "0974567890",
        role: "residential",
        registeredAt: new Date(now.getTime() - 45 * 60000).toISOString(),
        location: "Woodlands, Lusaka",
        verified: true,
      },
      {
        id: "reg-5",
        fullName: "Recyclers Ltd",
        phone: "0965678901",
        role: "recycler",
        registeredAt: new Date(now.getTime() - 60 * 60000).toISOString(),
        location: "Industrial Area, Lusaka",
        verified: false,
      },
    ];
    setRecentRegistrations(demoRegistrations);

    // Demo pending subscriptions
    const demoPendingSubscriptions: PendingSubscription[] = [
      {
        id: "sub-1",
        userId: "user-1",
        userName: "John Mulenga",
        phone: "0971111111",
        planName: "Residential Premium",
        planPrice: 180,
        requestedAt: new Date(now.getTime() - 10 * 60000).toISOString(),
        paymentStatus: "pending",
      },
      {
        id: "sub-2",
        userId: "user-2",
        userName: "ABC Company",
        phone: "0962222222",
        planName: "Commercial Basic",
        planPrice: 350,
        requestedAt: new Date(now.getTime() - 25 * 60000).toISOString(),
        paymentStatus: "awaiting_verification",
      },
      {
        id: "sub-3",
        userId: "user-3",
        userName: "Mary Tembo",
        phone: "0953333333",
        planName: "Residential Basic",
        planPrice: 100,
        requestedAt: new Date(now.getTime() - 40 * 60000).toISOString(),
        paymentStatus: "pending",
      },
    ];
    setPendingSubscriptions(demoPendingSubscriptions);

    // Demo live pickups
    const demoLivePickups: LivePickup[] = [
      {
        id: "pickup-1",
        customerId: "cust-1",
        customerName: "Sarah Mwale",
        location: {
          latitude: -15.4167,
          longitude: 28.2833,
          address: "Plot 123, Kabulonga, Lusaka",
        },
        binType: "240L Standard",
        status: "pending",
        pinnedAt: new Date(now.getTime() - 3 * 60000).toISOString(),
      },
      {
        id: "pickup-2",
        customerId: "cust-2",
        customerName: "David Zimba",
        location: {
          latitude: -15.4267,
          longitude: 28.2933,
          address: "House 45, Woodlands, Lusaka",
        },
        binType: "120L Small",
        status: "accepted",
        collectorId: "col-1",
        collectorName: "James Phiri",
        pinnedAt: new Date(now.getTime() - 8 * 60000).toISOString(),
      },
      {
        id: "pickup-3",
        customerId: "cust-3",
        customerName: "XYZ Restaurant",
        location: {
          latitude: -15.4067,
          longitude: 28.2733,
          address: "Cairo Road, Lusaka CBD",
        },
        binType: "660L Commercial",
        status: "in_progress",
        collectorId: "col-2",
        collectorName: "Moses Banda",
        pinnedAt: new Date(now.getTime() - 15 * 60000).toISOString(),
      },
      {
        id: "pickup-4",
        customerId: "cust-4",
        customerName: "Linda Sakala",
        location: {
          latitude: -15.4367,
          longitude: 28.3033,
          address: "Plot 78, Chelstone, Lusaka",
        },
        binType: "240L Standard",
        status: "pending",
        pinnedAt: new Date(now.getTime() - 1 * 60000).toISOString(),
        scheduledFor: new Date(now.getTime() + 2 * 3600000).toISOString(),
      },
    ];
    setLivePickups(demoLivePickups);

    // Demo subscription events
    const demoSubscriptionEvents: SubscriptionEvent[] = [
      {
        id: "sev-1",
        userId: "user-10",
        userName: "Michael Zulu",
        phone: "0971010101",
        planName: "Residential Premium",
        planPrice: 180,
        eventType: "new",
        timestamp: new Date(now.getTime() - 2 * 60000).toISOString(),
      },
      {
        id: "sev-2",
        userId: "user-11",
        userName: "Tech Solutions Ltd",
        phone: "0962020202",
        planName: "Commercial Premium",
        planPrice: 500,
        eventType: "renewed",
        timestamp: new Date(now.getTime() - 20 * 60000).toISOString(),
      },
      {
        id: "sev-3",
        userId: "user-12",
        userName: "Jane Mwanza",
        phone: "0953030303",
        planName: "Residential Basic",
        planPrice: 100,
        eventType: "expired",
        timestamp: new Date(now.getTime() - 35 * 60000).toISOString(),
      },
    ];
    setSubscriptionEvents(demoSubscriptionEvents);

    // Demo events
    const demoEvents: ITRealtimeEvent[] = [
      {
        id: "evt-1",
        type: "new_registration",
        title: "New User Registration",
        description: "Mwamba Chanda registered as residential customer",
        timestamp: new Date(now.getTime() - 5 * 60000).toISOString(),
        data: { userName: "Mwamba Chanda", userRole: "residential", phone: "0971234567" },
        read: false,
        priority: "medium",
      },
      {
        id: "evt-2",
        type: "pickup_pinned",
        title: "New Pickup Request",
        description: "Sarah Mwale pinned a pickup at Kabulonga",
        timestamp: new Date(now.getTime() - 3 * 60000).toISOString(),
        data: { userName: "Sarah Mwale", location: "Kabulonga, Lusaka", pickupId: "pickup-1" },
        read: false,
        priority: "high",
      },
      {
        id: "evt-3",
        type: "subscription_new",
        title: "New Subscription",
        description: "Michael Zulu subscribed to Residential Premium",
        timestamp: new Date(now.getTime() - 2 * 60000).toISOString(),
        data: { userName: "Michael Zulu", planName: "Residential Premium", amount: 180 },
        read: false,
        priority: "high",
      },
      {
        id: "evt-4",
        type: "collector_online",
        title: "Collector Online",
        description: "James Phiri is now available for pickups",
        timestamp: new Date(now.getTime() - 10 * 60000).toISOString(),
        data: { collectorName: "James Phiri", collectorId: "col-1" },
        read: true,
        priority: "low",
      },
      {
        id: "evt-5",
        type: "payment_pending",
        title: "Payment Pending",
        description: "ABC Company payment awaiting verification",
        timestamp: new Date(now.getTime() - 25 * 60000).toISOString(),
        data: { userName: "ABC Company", amount: 350, planName: "Commercial Basic" },
        read: false,
        priority: "medium",
      },
    ];
    setEvents(demoEvents);
  };

  const addEvent = useCallback((event: Omit<ITRealtimeEvent, "id" | "timestamp" | "read">) => {
    const newEvent: ITRealtimeEvent = {
      ...event,
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setEvents((prev) => [newEvent, ...prev].slice(0, 100)); // Keep last 100 events
  }, []);

  const markEventRead = useCallback((eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, read: true } : e))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setEvents((prev) => prev.map((e) => ({ ...e, read: true })));
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const addRegistration = useCallback((registration: Omit<RecentRegistration, "id" | "registeredAt">) => {
    const newReg: RecentRegistration = {
      ...registration,
      id: `reg-${Date.now()}`,
      registeredAt: new Date().toISOString(),
    };
    setRecentRegistrations((prev) => [newReg, ...prev].slice(0, 50));
    
    // Also add as event
    addEvent({
      type: "new_registration",
      title: "New User Registration",
      description: `${registration.fullName} registered as ${registration.role}`,
      data: { userName: registration.fullName, userRole: registration.role, phone: registration.phone },
      priority: "medium",
    });
  }, [addEvent]);

  const addPendingSubscription = useCallback((subscription: Omit<PendingSubscription, "id" | "requestedAt">) => {
    const newSub: PendingSubscription = {
      ...subscription,
      id: `sub-${Date.now()}`,
      requestedAt: new Date().toISOString(),
    };
    setPendingSubscriptions((prev) => [newSub, ...prev]);
    
    addEvent({
      type: "subscription_pending",
      title: "Pending Subscription",
      description: `${subscription.userName} requested ${subscription.planName}`,
      data: { userName: subscription.userName, planName: subscription.planName, amount: subscription.planPrice },
      priority: "medium",
    });
  }, [addEvent]);

  const removePendingSubscription = useCallback((subscriptionId: string) => {
    setPendingSubscriptions((prev) => prev.filter((s) => s.id !== subscriptionId));
  }, []);

  const addLivePickup = useCallback((pickup: Omit<LivePickup, "id" | "pinnedAt">) => {
    const newPickup: LivePickup = {
      ...pickup,
      id: `pickup-${Date.now()}`,
      pinnedAt: new Date().toISOString(),
    };
    setLivePickups((prev) => [newPickup, ...prev]);
    
    addEvent({
      type: "pickup_pinned",
      title: "New Pickup Request",
      description: `${pickup.customerName} pinned a pickup at ${pickup.location.address}`,
      data: { userName: pickup.customerName, location: pickup.location.address, pickupId: newPickup.id },
      priority: "high",
    });
  }, [addEvent]);

  const updateLivePickup = useCallback((pickupId: string, updates: Partial<LivePickup>) => {
    setLivePickups((prev) =>
      prev.map((p) => (p.id === pickupId ? { ...p, ...updates } : p))
    );
    
    if (updates.status === "accepted") {
      addEvent({
        type: "pickup_accepted",
        title: "Pickup Accepted",
        description: `${updates.collectorName} accepted pickup`,
        data: { collectorName: updates.collectorName, pickupId },
        priority: "medium",
      });
    } else if (updates.status === "completed") {
      addEvent({
        type: "pickup_completed",
        title: "Pickup Completed",
        description: `Pickup ${pickupId} has been completed`,
        data: { pickupId },
        priority: "low",
      });
    }
  }, [addEvent]);

  const removeLivePickup = useCallback((pickupId: string) => {
    setLivePickups((prev) => prev.filter((p) => p.id !== pickupId));
  }, []);

  const addSubscriptionEvent = useCallback((event: Omit<SubscriptionEvent, "id" | "timestamp">) => {
    const newEvent: SubscriptionEvent = {
      ...event,
      id: `sev-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setSubscriptionEvents((prev) => [newEvent, ...prev].slice(0, 50));
    
    const eventTypeMap: Record<string, ITEventType> = {
      new: "subscription_new",
      renewed: "subscription_renewed",
      expired: "subscription_expired",
    };
    
    addEvent({
      type: eventTypeMap[event.eventType] || "subscription_new",
      title: event.eventType === "new" ? "New Subscription" : 
             event.eventType === "renewed" ? "Subscription Renewed" : "Subscription Expired",
      description: `${event.userName} - ${event.planName}`,
      data: { userName: event.userName, planName: event.planName, amount: event.planPrice },
      priority: event.eventType === "expired" ? "high" : "medium",
    });
  }, [addEvent]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await loadData();
    // Also refresh from actual user/pickup data
    try {
      const usersDb = await AsyncStorage.getItem(BUS_KEYS.USERS_DB);
      if (usersDb) {
        const users = Object.values(JSON.parse(usersDb)) as any[];
        const recentUsers = users
          .filter((u: any) => u.id && u.fullName && u.phone)
          .sort((a: any, b: any) => (b.id > a.id ? 1 : -1))
          .slice(0, 10)
          .map((u: any) => ({
            id: u.id,
            fullName: u.fullName,
            phone: u.phone,
            role: u.role || "residential",
            registeredAt: new Date().toISOString(),
            verified: true,
          }));
        if (recentUsers.length > 0) {
          setRecentRegistrations((prev) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const newEntries = recentUsers.filter((r: any) => !existingIds.has(r.id));
            return [...newEntries, ...prev].slice(0, 20);
          });
        }
      }
    } catch (_) {}
    setIsLoading(false);
  }, [loadData]);

  const unreadCount = events.filter((e) => !e.read).length;

  const stats = {
    totalRegistrationsToday: recentRegistrations.filter((r) => {
      const today = new Date().toDateString();
      return new Date(r.registeredAt).toDateString() === today;
    }).length,
    totalPickupsToday: livePickups.length + 12, // Add some completed ones
    activePickups: livePickups.filter((p) => p.status !== "completed").length,
    pendingPayments: pendingSubscriptions.length,
    onlineCollectors: 8, // Demo value
  };

  return (
    <ITRealtimeContext.Provider
      value={{
        events,
        unreadCount,
        addEvent,
        markEventRead,
        markAllRead,
        clearEvents,
        recentRegistrations,
        addRegistration,
        pendingSubscriptions,
        addPendingSubscription,
        removePendingSubscription,
        livePickups,
        addLivePickup,
        updateLivePickup,
        removeLivePickup,
        subscriptionEvents,
        addSubscriptionEvent,
        stats,
        refreshData,
        isLoading,
      }}
    >
      {children}
    </ITRealtimeContext.Provider>
  );
}

export function useITRealtime() {
  const context = useContext(ITRealtimeContext);
  if (context === undefined) {
    throw new Error("useITRealtime must be used within an ITRealtimeProvider");
  }
  return context;
}
