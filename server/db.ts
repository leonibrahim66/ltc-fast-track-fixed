import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _dbInitFailed = false;  // tracks a permanent config error (no DATABASE_URL)
let _lastRetryAt = 0;       // timestamp of last failed connection attempt
const RETRY_INTERVAL_MS = 30_000; // retry DB connection every 30 seconds

/**
 * Lazily create the drizzle instance.
 * - Returns null (not throws) if DATABASE_URL is missing or connection fails.
 * - Retries failed connections every 30 seconds instead of caching null permanently.
 * - Does NOT crash the API — callers must handle null gracefully.
 */
export async function getDb() {
  // Already connected
  if (_db) return _db;

  // No DATABASE_URL configured — permanent failure, don't retry
  if (!process.env.DATABASE_URL) {
    if (!_dbInitFailed) {
      console.error("[Database] DATABASE_URL is not set. Database features are disabled.");
      _dbInitFailed = true;
    }
    return null;
  }

  // Throttle retry attempts
  const now = Date.now();
  if (_lastRetryAt > 0 && now - _lastRetryAt < RETRY_INTERVAL_MS) {
    return null;
  }

  try {
    _lastRetryAt = now;
    _db = drizzle(process.env.DATABASE_URL);
    console.log("[Database] Connected successfully.");
    return _db;
  } catch (error) {
    console.error("[Database] Failed to connect:", error instanceof Error ? error.message : error);
    _db = null;
    return null;
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * BOOKINGS QUERIES
 */

export async function getAvailableBookings() {
  const db = await getDb();
  if (!db) return [];

  const { bookings } = await import("../drizzle/schema");
  return db.select().from(bookings).where(eq(bookings.status, "pending"));
}

export async function getBookingsByDriver(driverId: number) {
  const db = await getDb();
  if (!db) return [];

  const { bookings } = await import("../drizzle/schema");
  return db
    .select()
    .from(bookings)
    .where(and(eq(bookings.driverId, driverId), eq(bookings.status, "accepted")));
}

export async function getBookingById(bookingId: number) {
  const db = await getDb();
  if (!db) return null;

  const { bookings } = await import("../drizzle/schema");
  const result = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  return result[0] || null;
}

export async function acceptBooking(bookingId: number, driverId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { bookings } = await import("../drizzle/schema");
  await db
    .update(bookings)
    .set({ driverId, status: "accepted" })
    .where(eq(bookings.id, bookingId));
}

export async function rejectBooking(bookingId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { bookings } = await import("../drizzle/schema");
  await db.update(bookings).set({ status: "rejected" }).where(eq(bookings.id, bookingId));
}

export async function updateBookingStatus(
  bookingId: number,
  status: "in-progress" | "completed" | "cancelled"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { bookings } = await import("../drizzle/schema");
  const updateData: any = { status };
  if (status === "completed") {
    updateData.completedAt = new Date();
  }

  await db.update(bookings).set(updateData).where(eq(bookings.id, bookingId));
}

export async function createBooking(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { bookings } = await import("../drizzle/schema");
  await db.insert(bookings).values(data);
  return true;
}

export async function getAllBookings() {
  const db = await getDb();
  if (!db) return [];

  const { bookings } = await import("../drizzle/schema");
  return db.select().from(bookings);
}

export async function getCompletedBookingsByDriver(driverId: number) {
  const db = await getDb();
  if (!db) return [];

  const { bookings } = await import("../drizzle/schema");
  return db
    .select()
    .from(bookings)
    .where(and(eq(bookings.driverId, driverId), eq(bookings.status, "completed")));
}

/**
 * VEHICLES QUERIES
 */

export async function getVehiclesByDriver(driverId: number) {
  const db = await getDb();
  if (!db) return [];

  const { vehicles } = await import("../drizzle/schema");
  return db.select().from(vehicles).where(eq(vehicles.driverId, driverId));
}

export async function getActiveVehicleByDriver(driverId: number) {
  const db = await getDb();
  if (!db) return null;

  const { vehicles } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.driverId, driverId), eq(vehicles.isActive, true)));

  return result[0] || null;
}

export async function createVehicle(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { vehicles } = await import("../drizzle/schema");
  await db.insert(vehicles).values(data);
  return true;
}

export async function updateVehicle(vehicleId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { vehicles } = await import("../drizzle/schema");
  await db.update(vehicles).set(data).where(eq(vehicles.id, vehicleId));
}

export async function getVehicleById(vehicleId: number) {
  const db = await getDb();
  if (!db) return null;

  const { vehicles } = await import("../drizzle/schema");
  const result = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
  return result[0] || null;
}

export async function getAllUsers(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).limit(limit);
}

// ─── User Notifications ────────────────────────────────────────────────────────

export async function getUserNotifications(userId: string, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const { userNotifications } = await import("../drizzle/schema");
  return db
    .select()
    .from(userNotifications)
    .where(eq(userNotifications.userId, userId))
    .orderBy(userNotifications.createdAt)
    .limit(limit);
}

export async function createUserNotification(data: {
  userId: string;
  type: "pickup_update" | "driver_accepted" | "driver_arriving" | "pickup_completed" | "payment" | "subscription" | "system" | "support";
  title: string;
  body: string;
  data?: string;
  pickupId?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const { userNotifications } = await import("../drizzle/schema");
  const result = await db.insert(userNotifications).values({
    ...data,
    isRead: false,
  });
  return (result as any).insertId as number | undefined;
}

export async function markUserNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  const { userNotifications } = await import("../drizzle/schema");
  await db.update(userNotifications).set({ isRead: true }).where(eq(userNotifications.id, id));
}

export async function markAllUserNotificationsRead(userId: string) {
  const db = await getDb();
  if (!db) return;
  const { userNotifications } = await import("../drizzle/schema");
  await db
    .update(userNotifications)
    .set({ isRead: true })
    .where(eq(userNotifications.userId, userId));
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const { userNotifications } = await import("../drizzle/schema");
  const rows = await db
    .select()
    .from(userNotifications)
    .where(eq(userNotifications.userId, userId));
  return rows.filter((r) => !r.isRead).length;
}
