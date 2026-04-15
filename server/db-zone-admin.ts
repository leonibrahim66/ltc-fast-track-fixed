import { db } from "./db";
import { 
  zoneGeometries, 
  zoneAdminProfiles, 
  zoneAdminZones, 
  zoneAuditLog,
  zones 
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Zone Admin Management Database Functions
 * Handles zone creation, geometry management, and admin operations
 */

/**
 * Create zone admin profile
 */
export async function createZoneAdminProfile(data: {
  userId: number;
  fullName: string;
  phone: string;
  email?: string;
}) {
  const result = await db.insert(zoneAdminProfiles).values({
    userId: data.userId,
    fullName: data.fullName,
    phone: data.phone,
    email: data.email,
    isApproved: false,
  });
  return result[0].insertId;
}

/**
 * Approve zone admin (by super admin)
 */
export async function approveZoneAdmin(zoneAdminId: number, approvedBy: number) {
  await db.update(zoneAdminProfiles)
    .set({
      isApproved: true,
      approvedAt: new Date(),
      approvedBy,
    })
    .where(eq(zoneAdminProfiles.id, zoneAdminId));
}

/**
 * Get zone admin profile
 */
export async function getZoneAdminProfile(zoneAdminId: number) {
  const result = await db.select()
    .from(zoneAdminProfiles)
    .where(eq(zoneAdminProfiles.id, zoneAdminId));
  return result[0] || null;
}

/**
 * Get zone admin by user ID
 */
export async function getZoneAdminByUserId(userId: number) {
  const result = await db.select()
    .from(zoneAdminProfiles)
    .where(eq(zoneAdminProfiles.userId, userId));
  return result[0] || null;
}

/**
 * Create zone with geometry (map-drawn boundaries)
 */
export async function createZoneWithGeometry(data: {
  name: string;
  city: string;
  description?: string;
  geometryType: "polygon" | "circle" | "point";
  coordinates: any; // GeoJSON coordinates
  centerLat?: number;
  centerLng?: number;
  radiusMeters?: number;
  createdBy: number;
}) {
  // Create zone
  const zoneResult = await db.insert(zones).values({
    name: data.name,
    city: data.city,
    description: data.description,
    boundaries: JSON.stringify(data.coordinates),
    status: "active",
  });

  const zoneId = zoneResult[0].insertId;

  // Create geometry
  await db.insert(zoneGeometries).values({
    zoneId,
    geometryType: data.geometryType,
    coordinates: JSON.stringify(data.coordinates),
    centerLat: data.centerLat,
    centerLng: data.centerLng,
    radiusMeters: data.radiusMeters,
    createdBy: data.createdBy,
  });

  // Log audit
  await db.insert(zoneAuditLog).values({
    zoneId,
    action: "created",
    createdBy: data.createdBy,
    details: JSON.stringify({
      geometryType: data.geometryType,
      method: "map_drawing",
    }),
  });

  return zoneId;
}

/**
 * Create zone by name detection (auto-detection)
 */
export async function createZoneByNameDetection(data: {
  name: string;
  city: string;
  description?: string;
  detectedCoordinates: any; // Auto-detected from zone name
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  createdBy: number;
}) {
  // Create zone
  const zoneResult = await db.insert(zones).values({
    name: data.name,
    city: data.city,
    description: data.description,
    boundaries: JSON.stringify(data.detectedCoordinates),
    status: "active",
  });

  const zoneId = zoneResult[0].insertId;

  // Create geometry with auto-detected boundaries
  await db.insert(zoneGeometries).values({
    zoneId,
    geometryType: "circle",
    coordinates: JSON.stringify(data.detectedCoordinates),
    centerLat: data.centerLat,
    centerLng: data.centerLng,
    radiusMeters: data.radiusMeters,
    createdBy: data.createdBy,
  });

  // Log audit
  await db.insert(zoneAuditLog).values({
    zoneId,
    action: "name_detected",
    createdBy: data.createdBy,
    details: JSON.stringify({
      geometryType: "circle",
      method: "name_detection",
      detectedRadius: data.radiusMeters,
    }),
  });

  return zoneId;
}

/**
 * Get zone geometry
 */
export async function getZoneGeometry(zoneId: number) {
  const result = await db.select()
    .from(zoneGeometries)
    .where(eq(zoneGeometries.zoneId, zoneId));
  return result[0] || null;
}

/**
 * Update zone geometry (redraw boundaries)
 */
export async function updateZoneGeometry(data: {
  zoneId: number;
  geometryType: "polygon" | "circle" | "point";
  coordinates: any;
  centerLat?: number;
  centerLng?: number;
  radiusMeters?: number;
  updatedBy: number;
}) {
  // Update geometry
  await db.update(zoneGeometries)
    .set({
      geometryType: data.geometryType,
      coordinates: JSON.stringify(data.coordinates),
      centerLat: data.centerLat,
      centerLng: data.centerLng,
      radiusMeters: data.radiusMeters,
      updatedAt: new Date(),
    })
    .where(eq(zoneGeometries.zoneId, data.zoneId));

  // Update zone boundaries
  await db.update(zones)
    .set({
      boundaries: JSON.stringify(data.coordinates),
      updatedAt: new Date(),
    })
    .where(eq(zones.id, data.zoneId));

  // Log audit
  await db.insert(zoneAuditLog).values({
    zoneId: data.zoneId,
    action: "boundary_updated",
    createdBy: data.updatedBy,
    details: JSON.stringify({
      geometryType: data.geometryType,
    }),
  });
}

/**
 * Assign zone admin to zone
 */
export async function assignZoneAdminToZone(data: {
  zoneAdminId: number;
  zoneId: number;
  createdBy: number;
}) {
  const result = await db.insert(zoneAdminZones).values({
    zoneAdminId: data.zoneAdminId,
    zoneId: data.zoneId,
    createdBy: data.createdBy,
  });

  // Log audit
  await db.insert(zoneAuditLog).values({
    zoneId: data.zoneId,
    action: "auto_assigned_manager",
    createdBy: data.createdBy,
    details: JSON.stringify({
      zoneAdminId: data.zoneAdminId,
    }),
  });

  return result[0].insertId;
}

/**
 * Get zones managed by admin
 */
export async function getZonesByAdmin(zoneAdminId: number) {
  const result = await db.select({
    zone: zones,
    admin: zoneAdminZones,
  })
    .from(zoneAdminZones)
    .innerJoin(zones, eq(zoneAdminZones.zoneId, zones.id))
    .where(eq(zoneAdminZones.zoneAdminId, zoneAdminId));

  return result.map(r => ({
    ...r.zone,
    assignedAt: r.admin.assignedAt,
  }));
}

/**
 * Get all zone admins
 */
export async function getAllZoneAdmins() {
  return await db.select()
    .from(zoneAdminProfiles)
    .orderBy(zoneAdminProfiles.createdAt);
}

/**
 * Get pending zone admin approvals
 */
export async function getPendingZoneAdminApprovals() {
  return await db.select()
    .from(zoneAdminProfiles)
    .where(eq(zoneAdminProfiles.isApproved, false));
}

/**
 * Get zone audit log
 */
export async function getZoneAuditLog(zoneId: number) {
  return await db.select()
    .from(zoneAuditLog)
    .where(eq(zoneAuditLog.zoneId, zoneId))
    .orderBy(zoneAuditLog.createdAt);
}

/**
 * Check if point is within zone (using simple distance calculation)
 * For production, use proper GIS functions in database
 */
export function isPointInZone(
  pointLat: number,
  pointLng: number,
  geometry: any
): boolean {
  if (geometry.geometryType === "circle") {
    // Simple distance calculation (Haversine)
    const distance = calculateDistance(
      pointLat,
      pointLng,
      Number(geometry.centerLat),
      Number(geometry.centerLng)
    );
    return distance <= (geometry.radiusMeters || 0);
  } else if (geometry.geometryType === "polygon") {
    // Point-in-polygon algorithm
    const coordinates = JSON.parse(geometry.coordinates);
    return pointInPolygon(pointLat, pointLng, coordinates);
  }
  return false;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Point-in-polygon algorithm (Ray casting)
 */
function pointInPolygon(
  lat: number,
  lng: number,
  polygon: number[][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1];
    const yi = polygon[i][0];
    const xj = polygon[j][1];
    const yj = polygon[j][0];

    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Get zone statistics
 */
export async function getZoneStatistics(zoneId: number) {
  const zone = await db.select()
    .from(zones)
    .where(eq(zones.id, zoneId));

  const admins = await db.select()
    .from(zoneAdminZones)
    .where(eq(zoneAdminZones.zoneId, zoneId));

  const auditLog = await db.select()
    .from(zoneAuditLog)
    .where(eq(zoneAuditLog.zoneId, zoneId));

  return {
    zone: zone[0],
    adminCount: admins.length,
    auditLogCount: auditLog.length,
    lastModified: auditLog[0]?.createdAt || zone[0]?.createdAt,
  };
}
