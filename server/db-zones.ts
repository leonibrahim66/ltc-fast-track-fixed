import { eq, and, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import { zones, zoneCollectors, InsertZone, InsertZoneCollector } from "../drizzle/schema";

/**
 * ZONE QUERIES
 */

export async function getAllZones(statusFilter?: "active" | "inactive" | "all") {
  const db = await getDb();
  if (!db) return [];

  try {
    if (statusFilter === "all" || !statusFilter) {
      return await db.select().from(zones);
    }
    return await db.select().from(zones).where(eq(zones.status, statusFilter));
  } catch (error) {
    console.error("[Database] Failed to get zones:", error);
    return [];
  }
}

export async function getZoneById(zoneId: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db.select().from(zones).where(eq(zones.id, zoneId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get zone by ID:", error);
    return undefined;
  }
}

export async function createZone(zoneData: InsertZone) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const result = await db.insert(zones).values(zoneData);
    // Return the created zone ID
    return (result as any).insertId as number;
  } catch (error) {
    console.error("[Database] Failed to create zone:", error);
    throw error;
  }
}

export async function updateZone(zoneId: number, zoneData: Partial<InsertZone>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.update(zones).set(zoneData).where(eq(zones.id, zoneId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update zone:", error);
    throw error;
  }
}

export async function deleteZone(zoneId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Delete zone collector assignments first
    await db.delete(zoneCollectors).where(eq(zoneCollectors.zoneId, zoneId));
    // Delete the zone
    await db.delete(zones).where(eq(zones.id, zoneId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete zone:", error);
    throw error;
  }
}

export async function getZoneStats() {
  const db = await getDb();
  if (!db) return {
    totalZones: 0,
    assignedCollectors: 0,
    totalHouseholds: 0,
    unassignedHouseholds: 0,
  };

  try {
    // Get total zones
    const zoneCount = await db.select({ count: sql<number>`count(*)` }).from(zones);
    const totalZones = zoneCount[0]?.count || 0;

    // Get assigned collectors count
    const collectorCount = await db.select({ count: sql<number>`count(DISTINCT ${zoneCollectors.collectorId})` }).from(zoneCollectors);
    const assignedCollectors = collectorCount[0]?.count || 0;

    // Get total households (sum of householdCount from all zones)
    const householdSum = await db.select({ total: sql<number>`sum(${zones.householdCount})` }).from(zones);
    const totalHouseholds = householdSum[0]?.total || 0;

    return {
      totalZones,
      assignedCollectors,
      totalHouseholds,
      unassignedHouseholds: 0, // TODO: Calculate from households table when implemented
    };
  } catch (error) {
    console.error("[Database] Failed to get zone stats:", error);
    return {
      totalZones: 0,
      assignedCollectors: 0,
      totalHouseholds: 0,
      unassignedHouseholds: 0,
    };
  }
}

/**
 * ZONE COLLECTOR ASSIGNMENT QUERIES
 */

export async function assignCollectorToZone(collectorId: number, zoneId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Check if already assigned
    const existing = await db
      .select()
      .from(zoneCollectors)
      .where(and(eq(zoneCollectors.collectorId, collectorId), eq(zoneCollectors.zoneId, zoneId)))
      .limit(1);

    if (existing.length > 0) {
      return false; // Already assigned
    }

    await db.insert(zoneCollectors).values({ collectorId, zoneId });

    // Update collector count in zone
    await db.execute(sql`
      UPDATE ${zones}
      SET collectorCount = (
        SELECT COUNT(*) FROM ${zoneCollectors}
        WHERE ${zoneCollectors.zoneId} = ${zoneId}
      )
      WHERE id = ${zoneId}
    `);

    return true;
  } catch (error) {
    console.error("[Database] Failed to assign collector:", error);
    throw error;
  }
}

export async function unassignCollectorFromZone(collectorId: number, zoneId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    if (zoneId) {
      // Unassign from specific zone
      await db.delete(zoneCollectors).where(
        and(eq(zoneCollectors.collectorId, collectorId), eq(zoneCollectors.zoneId, zoneId))
      );

      // Update collector count in zone
      await db.execute(sql`
        UPDATE ${zones}
        SET collectorCount = (
          SELECT COUNT(*) FROM ${zoneCollectors}
          WHERE ${zoneCollectors.zoneId} = ${zoneId}
        )
        WHERE id = ${zoneId}
      `);
    } else {
      // Unassign from all zones
      const assignments = await db.select().from(zoneCollectors).where(eq(zoneCollectors.collectorId, collectorId));
      const zoneIds = assignments.map((a) => a.zoneId);

      await db.delete(zoneCollectors).where(eq(zoneCollectors.collectorId, collectorId));

      // Update collector counts for all affected zones
      if (zoneIds.length > 0) {
        for (const id of zoneIds) {
          await db.execute(sql`
            UPDATE ${zones}
            SET collectorCount = (
              SELECT COUNT(*) FROM ${zoneCollectors}
              WHERE ${zoneCollectors.zoneId} = ${id}
            )
            WHERE id = ${id}
          `);
        }
      }
    }

    return true;
  } catch (error) {
    console.error("[Database] Failed to unassign collector:", error);
    throw error;
  }
}

export async function getCollectorsByZone(zoneId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db.select().from(zoneCollectors).where(eq(zoneCollectors.zoneId, zoneId));
    return result.map((r) => r.collectorId);
  } catch (error) {
    console.error("[Database] Failed to get collectors by zone:", error);
    return [];
  }
}

export async function getZonesByCollector(collectorId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db.select().from(zoneCollectors).where(eq(zoneCollectors.collectorId, collectorId));
    return result.map((r) => r.zoneId);
  } catch (error) {
    console.error("[Database] Failed to get zones by collector:", error);
    return [];
  }
}
