import { eq, and, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  zoneManagers,
  zoneManagerDrivers,
  customerZoneAssignments,
  garbagePickups,
  pickupAssignments,
  users,
  driverProfiles,
  zones,
  InsertZoneManager,
  InsertZoneManagerDriver,
  InsertCustomerZoneAssignment,
  InsertGarbagePickup,
  InsertPickupAssignment,
} from "../drizzle/schema";

/**
 * ZONE MANAGER QUERIES
 */

export async function assignZoneManager(userId: number, zoneId: number, commissionRate: number = 10.0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Check if already assigned
    const existing = await db
      .select()
      .from(zoneManagers)
      .where(and(eq(zoneManagers.userId, userId), eq(zoneManagers.zoneId, zoneId)))
      .limit(1);

    if (existing.length > 0) {
      return false; // Already assigned
    }

    // Update user role to zone_manager
    await db.update(users).set({ role: "zone_manager" }).where(eq(users.id, userId));

    // Create zone manager assignment
    const result = await db.insert(zoneManagers).values({
      userId,
      zoneId,
      commissionRate,
      status: "active",
    });

    return (result as any).insertId as number;
  } catch (error) {
    console.error("[Database] Failed to assign zone manager:", error);
    throw error;
  }
}

export async function getZoneManagersByZone(zoneId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select({
        id: zoneManagers.id,
        userId: zoneManagers.userId,
        zoneId: zoneManagers.zoneId,
        status: zoneManagers.status,
        commissionRate: zoneManagers.commissionRate,
        assignedAt: zoneManagers.assignedAt,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phone,
      })
      .from(zoneManagers)
      .innerJoin(users, eq(zoneManagers.userId, users.id))
      .where(and(eq(zoneManagers.zoneId, zoneId), eq(zoneManagers.status, "active")));
  } catch (error) {
    console.error("[Database] Failed to get zone managers by zone:", error);
    return [];
  }
}

export async function getZoneManagerDetails(zoneManagerId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select({
        id: zoneManagers.id,
        userId: zoneManagers.userId,
        zoneId: zoneManagers.zoneId,
        status: zoneManagers.status,
        commissionRate: zoneManagers.commissionRate,
        assignedAt: zoneManagers.assignedAt,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phone,
        zoneName: zones.name,
        zoneCity: zones.city,
      })
      .from(zoneManagers)
      .innerJoin(users, eq(zoneManagers.userId, users.id))
      .innerJoin(zones, eq(zoneManagers.zoneId, zones.id))
      .where(eq(zoneManagers.id, zoneManagerId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get zone manager details:", error);
    return null;
  }
}

export async function removeZoneManager(zoneManagerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db
      .update(zoneManagers)
      .set({ status: "inactive", unassignedAt: new Date() })
      .where(eq(zoneManagers.id, zoneManagerId));

    return true;
  } catch (error) {
    console.error("[Database] Failed to remove zone manager:", error);
    throw error;
  }
}

/**
 * ZONE MANAGER DRIVER QUERIES
 */

export async function assignDriverToZoneManager(zoneManagerId: number, driverId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Check if already assigned
    const existing = await db
      .select()
      .from(zoneManagerDrivers)
      .where(and(eq(zoneManagerDrivers.zoneManagerId, zoneManagerId), eq(zoneManagerDrivers.driverId, driverId)))
      .limit(1);

    if (existing.length > 0) {
      return false; // Already assigned
    }

    const result = await db.insert(zoneManagerDrivers).values({
      zoneManagerId,
      driverId,
      status: "active",
    });

    return (result as any).insertId as number;
  } catch (error) {
    console.error("[Database] Failed to assign driver to zone manager:", error);
    throw error;
  }
}

export async function getDriversByZoneManager(zoneManagerId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select({
        id: driverProfiles.id,
        userId: driverProfiles.userId,
        fullName: driverProfiles.fullName,
        phone: driverProfiles.phone,
        email: driverProfiles.email,
        vehicleType: driverProfiles.vehicleType,
        plateNumber: driverProfiles.plateNumber,
        isOnline: driverProfiles.isOnline,
        isApproved: driverProfiles.isApproved,
        isSuspended: driverProfiles.isSuspended,
        averageRating: driverProfiles.averageRating,
        totalCompletedJobs: driverProfiles.totalCompletedJobs,
        assignedAt: zoneManagerDrivers.assignedAt,
      })
      .from(zoneManagerDrivers)
      .innerJoin(driverProfiles, eq(zoneManagerDrivers.driverId, driverProfiles.id))
      .where(and(eq(zoneManagerDrivers.zoneManagerId, zoneManagerId), eq(zoneManagerDrivers.status, "active")));
  } catch (error) {
    console.error("[Database] Failed to get drivers by zone manager:", error);
    return [];
  }
}

export async function removeDriverFromZoneManager(zoneManagerId: number, driverId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db
      .update(zoneManagerDrivers)
      .set({ status: "inactive", unassignedAt: new Date() })
      .where(and(eq(zoneManagerDrivers.zoneManagerId, zoneManagerId), eq(zoneManagerDrivers.driverId, driverId)));

    return true;
  } catch (error) {
    console.error("[Database] Failed to remove driver from zone manager:", error);
    throw error;
  }
}

/**
 * CUSTOMER ZONE ASSIGNMENT QUERIES
 */

export async function assignCustomerToZone(
  userId: number,
  zoneId: number,
  address: string,
  latitude: number,
  longitude: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Delete existing assignment if any
    await db.delete(customerZoneAssignments).where(eq(customerZoneAssignments.userId, userId));

    // Create new assignment
    const result = await db.insert(customerZoneAssignments).values({
      userId,
      zoneId,
      address,
      latitude,
      longitude,
    });

    return (result as any).insertId as number;
  } catch (error) {
    console.error("[Database] Failed to assign customer to zone:", error);
    throw error;
  }
}

export async function getCustomerZoneAssignment(userId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select({
        id: customerZoneAssignments.id,
        userId: customerZoneAssignments.userId,
        zoneId: customerZoneAssignments.zoneId,
        address: customerZoneAssignments.address,
        latitude: customerZoneAssignments.latitude,
        longitude: customerZoneAssignments.longitude,
        assignedAt: customerZoneAssignments.assignedAt,
        zoneName: zones.name,
        zoneCity: zones.city,
      })
      .from(customerZoneAssignments)
      .innerJoin(zones, eq(customerZoneAssignments.zoneId, zones.id))
      .where(eq(customerZoneAssignments.userId, userId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get customer zone assignment:", error);
    return null;
  }
}

export async function getCustomersByZone(zoneId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        address: customerZoneAssignments.address,
        latitude: customerZoneAssignments.latitude,
        longitude: customerZoneAssignments.longitude,
        assignedAt: customerZoneAssignments.assignedAt,
      })
      .from(customerZoneAssignments)
      .innerJoin(users, eq(customerZoneAssignments.userId, users.id))
      .where(eq(customerZoneAssignments.zoneId, zoneId))
      .orderBy(customerZoneAssignments.assignedAt);
  } catch (error) {
    console.error("[Database] Failed to get customers by zone:", error);
    return [];
  }
}

/**
 * GARBAGE PICKUP QUERIES
 */

export async function createGarbagePickup(data: InsertGarbagePickup) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const result = await db.insert(garbagePickups).values(data);
    return (result as any).insertId as number;
  } catch (error) {
    console.error("[Database] Failed to create garbage pickup:", error);
    throw error;
  }
}

export async function getGarbagePickup(pickupId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(garbagePickups).where(eq(garbagePickups.id, pickupId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get garbage pickup:", error);
    return null;
  }
}

export async function getAvailablePickupsByZone(zoneId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(garbagePickups)
      .where(and(eq(garbagePickups.zoneId, zoneId), eq(garbagePickups.status, "pending")))
      .orderBy(garbagePickups.createdAt);
  } catch (error) {
    console.error("[Database] Failed to get available pickups by zone:", error);
    return [];
  }
}

export async function getUnassignedPickupsByZoneManager(zoneManagerId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select({
        id: garbagePickups.id,
        customerId: garbagePickups.customerId,
        zoneId: garbagePickups.zoneId,
        address: garbagePickups.address,
        latitude: garbagePickups.latitude,
        longitude: garbagePickups.longitude,
        status: garbagePickups.status,
        notes: garbagePickups.notes,
        createdAt: garbagePickups.createdAt,
        customerName: users.name,
        customerPhone: users.phone,
      })
      .from(garbagePickups)
      .innerJoin(users, eq(garbagePickups.customerId, users.id))
      .innerJoin(zoneManagers, eq(garbagePickups.zoneId, zoneManagers.zoneId))
      .where(
        and(
          eq(zoneManagers.id, zoneManagerId),
          eq(garbagePickups.status, "pending"),
          sql`${garbagePickups.driverId} IS NULL`
        )
      )
      .orderBy(garbagePickups.createdAt);
  } catch (error) {
    console.error("[Database] Failed to get unassigned pickups:", error);
    return [];
  }
}

export async function updateGarbagePickupStatus(pickupId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const updateData: any = { status };

    if (status === "accepted") {
      updateData.acceptedAt = new Date();
    } else if (status === "assigned") {
      updateData.assignedAt = new Date();
    } else if (status === "arrived") {
      updateData.arrivedAt = new Date();
    } else if (status === "completed") {
      updateData.completedAt = new Date();
    } else if (status === "cancelled") {
      updateData.cancelledAt = new Date();
    }

    await db.update(garbagePickups).set(updateData).where(eq(garbagePickups.id, pickupId));

    return true;
  } catch (error) {
    console.error("[Database] Failed to update garbage pickup status:", error);
    throw error;
  }
}

export async function assignPickupToDriver(pickupId: number, driverId: number, zoneManagerId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Update garbage pickup
    await db
      .update(garbagePickups)
      .set({
        driverId,
        zoneManagerId: zoneManagerId || null,
        status: "assigned",
        assignedAt: new Date(),
      })
      .where(eq(garbagePickups.id, pickupId));

    // Create pickup assignment
    const result = await db.insert(pickupAssignments).values({
      pickupId,
      driverId,
      assignedBy: zoneManagerId || null,
      status: "assigned",
      assignedAt: new Date(),
    });

    return (result as any).insertId as number;
  } catch (error) {
    console.error("[Database] Failed to assign pickup to driver:", error);
    throw error;
  }
}

export async function getPickupsByDriver(driverId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];

  try {
    let query = db
      .select({
        id: garbagePickups.id,
        customerId: garbagePickups.customerId,
        address: garbagePickups.address,
        latitude: garbagePickups.latitude,
        longitude: garbagePickups.longitude,
        status: garbagePickups.status,
        notes: garbagePickups.notes,
        createdAt: garbagePickups.createdAt,
        customerName: users.name,
        customerPhone: users.phone,
      })
      .from(garbagePickups)
      .innerJoin(users, eq(garbagePickups.customerId, users.id))
      .where(eq(garbagePickups.driverId, driverId));

    if (status) {
      query = query.where(eq(garbagePickups.status, status));
    }

    return await query.orderBy(garbagePickups.createdAt);
  } catch (error) {
    console.error("[Database] Failed to get pickups by driver:", error);
    return [];
  }
}

export async function getPickupsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select({
        id: garbagePickups.id,
        address: garbagePickups.address,
        status: garbagePickups.status,
        driverId: garbagePickups.driverId,
        createdAt: garbagePickups.createdAt,
        completedAt: garbagePickups.completedAt,
        driverName: driverProfiles.fullName,
        driverPhone: driverProfiles.phone,
      })
      .from(garbagePickups)
      .leftJoin(driverProfiles, eq(garbagePickups.driverId, driverProfiles.id))
      .where(eq(garbagePickups.customerId, customerId))
      .orderBy(garbagePickups.createdAt);
  } catch (error) {
    console.error("[Database] Failed to get pickups by customer:", error);
    return [];
  }
}
