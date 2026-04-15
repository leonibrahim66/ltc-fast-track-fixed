/**
 * StorageEventBus
 *
 * A lightweight in-process event emitter that enables real-time data
 * synchronization across all React contexts and screens within the same
 * app instance.
 *
 * How it works:
 *  1. Any context that writes to AsyncStorage calls `StorageEventBus.emit(key)`
 *     immediately after the write.
 *  2. Any context or screen that cares about that key calls
 *     `StorageEventBus.subscribe(key, callback)` and reloads its data.
 *  3. This gives instant same-device sync: when admin approves a subscription
 *     on the same device, the customer's home screen updates in <100 ms.
 *
 * Cross-device sync:
 *  - When the app returns to foreground (AppState "active"), every context
 *    re-reads its AsyncStorage key.  This covers the case where another device
 *    wrote data while this device was backgrounded.
 *  - For true real-time cross-device push, connect Supabase Realtime or
 *    Firebase RTDB and call `StorageEventBus.emit(key)` from the listener.
 *
 * Usage:
 *  // In a context that writes data:
 *  await AsyncStorage.setItem(KEY, JSON.stringify(data));
 *  StorageEventBus.emit(KEY);
 *
 *  // In a context or screen that reads data:
 *  useEffect(() => {
 *    const unsub = StorageEventBus.subscribe(KEY, loadData);
 *    return unsub;
 *  }, []);
 */

type Listener = () => void;

class StorageEventBusClass {
  private listeners: Map<string, Set<Listener>> = new Map();

  /** Subscribe to changes for a specific AsyncStorage key. Returns an unsubscribe fn. */
  subscribe(key: string, listener: Listener): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  /** Notify all subscribers that a key has changed. */
  emit(key: string): void {
    const set = this.listeners.get(key);
    if (!set) return;
    // Use setTimeout(0) to avoid calling setState during another setState cycle
    setTimeout(() => {
      set.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.warn(`[StorageEventBus] listener error for key "${key}":`, e);
        }
      });
    }, 0);
  }

  /** Emit multiple keys at once (convenience helper). */
  emitMany(keys: string[]): void {
    keys.forEach((k) => this.emit(k));
  }

  /** Remove all listeners for a key (use on unmount if needed). */
  clear(key: string): void {
    this.listeners.delete(key);
  }
}

export const StorageEventBus = new StorageEventBusClass();

// ─── Well-known AsyncStorage keys ────────────────────────────────────────────
// Import these constants in contexts instead of repeating string literals.
export const STORAGE_KEYS = {
  USERS_DB: "@ltc_users_db",
  USER: "@ltc_user",
  PICKUPS: "@ltc_pickups",
  DISPUTES: "@ltc_disputes",
  PAYMENTS: "ltc_payments",
  SUBSCRIPTION_REQUESTS: "ltc_subscription_approval_requests",
  SUBSCRIPTION_HISTORY: "ltc_subscription_approval_history",
  WITHDRAWALS: "ltc_withdrawals",
  ACTIVITY_LOGS: "@ltc_activity_logs",
  IT_REALTIME: "@ltc_it_realtime",
  NOTIFICATIONS: "ltc_notifications",
  RECYCLER_ORDERS: "@ltc_recycler_orders",
  CARRIER_BOOKINGS: "carrier_bookings",
  CARRIER_ACTIVE_JOBS: "carrier_active_jobs",
  CARRIER_WALLET_TX: "carrier_wallet_transactions",
  GC_COMPLETED_JOBS: "gc_completed_jobs",
  GC_COMMISSION: "gc_commission_data",
  DRIVER_STATUS: "@ltc_driver_status",
  ZONES: "@ltc_zones",
  SERVICE_ZONES: "@ltc_service_zones",
  HOUSEHOLDS: "@ltc_households",
  /** Special key: emitted by logout() to trigger immediate redirect in all layout guards */
  LOGOUT: "@ltc_logout_event",
} as const;
