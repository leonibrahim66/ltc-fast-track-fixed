import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db-zone-admin";

/**
 * Zone Admin API Routes
 * Handles zone creation, geometry management, and admin operations
 */

// Coordinate schema for GeoJSON
const CoordinateSchema = z.array(z.number()).length(2);
const PolygonCoordinatesSchema = z.array(z.array(CoordinateSchema));

// Zone creation schemas
const CreateZoneByDrawingSchema = z.object({
  name: z.string().min(1, "Zone name required"),
  city: z.string().min(1, "City required"),
  description: z.string().optional(),
  geometryType: z.enum(["polygon", "circle", "point"]),
  coordinates: z.union([PolygonCoordinatesSchema, z.array(CoordinateSchema)]),
  centerLat: z.number().optional(),
  centerLng: z.number().optional(),
  radiusMeters: z.number().optional(),
});

const CreateZoneByNameDetectionSchema = z.object({
  name: z.string().min(1, "Zone name required"),
  city: z.string().min(1, "City required"),
  description: z.string().optional(),
  detectedCoordinates: z.union([PolygonCoordinatesSchema, z.array(CoordinateSchema)]),
  centerLat: z.number(),
  centerLng: z.number(),
  radiusMeters: z.number(),
});

export const zoneAdminRouter = router({
  /**
   * Create zone admin profile (by super admin)
   */
  createZoneAdmin: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        fullName: z.string(),
        phone: z.string(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is super admin
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Admin access required");
        }

        const adminId = await db.createZoneAdminProfile(input);

        return {
          success: true,
          adminId,
          message: "Zone admin profile created successfully",
        };
      } catch (error) {
        console.error("[Zone Admin API] Error creating zone admin:", error);
        throw error;
      }
    }),

  /**
   * Approve zone admin (by super admin)
   */
  approveZoneAdmin: protectedProcedure
    .input(z.object({ zoneAdminId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is super admin
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Admin access required");
        }

        await db.approveZoneAdmin(input.zoneAdminId, ctx.user.id);

        return {
          success: true,
          message: "Zone admin approved successfully",
        };
      } catch (error) {
        console.error("[Zone Admin API] Error approving zone admin:", error);
        throw error;
      }
    }),

  /**
   * Get all zone admins (by super admin)
   */
  getAllZoneAdmins: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Verify user is super admin
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const admins = await db.getAllZoneAdmins();

      return {
        success: true,
        admins,
        total: admins.length,
      };
    } catch (error) {
      console.error("[Zone Admin API] Error fetching zone admins:", error);
      throw error;
    }
  }),

  /**
   * Get pending zone admin approvals (by super admin)
   */
  getPendingApprovals: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Verify user is super admin
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const pending = await db.getPendingZoneAdminApprovals();

      return {
        success: true,
        pending,
        total: pending.length,
      };
    } catch (error) {
      console.error("[Zone Admin API] Error fetching pending approvals:", error);
      throw error;
    }
  }),

  /**
   * Create zone by drawing on map
   */
  createZoneByDrawing: protectedProcedure
    .input(CreateZoneByDrawingSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is zone admin or super admin
        if (ctx.user.role !== "zone_admin" && ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Zone Admin access required");
        }

        const zoneId = await db.createZoneWithGeometry({
          name: input.name,
          city: input.city,
          description: input.description,
          geometryType: input.geometryType,
          coordinates: input.coordinates,
          centerLat: input.centerLat,
          centerLng: input.centerLng,
          radiusMeters: input.radiusMeters,
          createdBy: ctx.user.id,
        });

        return {
          success: true,
          zoneId,
          message: "Zone created successfully from map drawing",
        };
      } catch (error) {
        console.error("[Zone Admin API] Error creating zone by drawing:", error);
        throw error;
      }
    }),

  /**
   * Create zone by name detection
   */
  createZoneByNameDetection: protectedProcedure
    .input(CreateZoneByNameDetectionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is zone admin or super admin
        if (ctx.user.role !== "zone_admin" && ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Zone Admin access required");
        }

        const zoneId = await db.createZoneByNameDetection({
          name: input.name,
          city: input.city,
          description: input.description,
          detectedCoordinates: input.detectedCoordinates,
          centerLat: input.centerLat,
          centerLng: input.centerLng,
          radiusMeters: input.radiusMeters,
          createdBy: ctx.user.id,
        });

        return {
          success: true,
          zoneId,
          message: "Zone created successfully from name detection",
        };
      } catch (error) {
        console.error("[Zone Admin API] Error creating zone by name detection:", error);
        throw error;
      }
    }),

  /**
   * Get zone geometry
   */
  getZoneGeometry: protectedProcedure
    .input(z.object({ zoneId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const geometry = await db.getZoneGeometry(input.zoneId);

        if (!geometry) {
          throw new Error("Zone geometry not found");
        }

        return {
          success: true,
          geometry: {
            ...geometry,
            coordinates: JSON.parse(geometry.coordinates),
          },
        };
      } catch (error) {
        console.error("[Zone Admin API] Error fetching zone geometry:", error);
        throw error;
      }
    }),

  /**
   * Update zone geometry (redraw boundaries)
   */
  updateZoneGeometry: protectedProcedure
    .input(
      z.object({
        zoneId: z.number(),
        geometryType: z.enum(["polygon", "circle", "point"]),
        coordinates: z.union([PolygonCoordinatesSchema, z.array(CoordinateSchema)]),
        centerLat: z.number().optional(),
        centerLng: z.number().optional(),
        radiusMeters: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is zone admin or super admin
        if (ctx.user.role !== "zone_admin" && ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Zone Admin access required");
        }

        await db.updateZoneGeometry({
          zoneId: input.zoneId,
          geometryType: input.geometryType,
          coordinates: input.coordinates,
          centerLat: input.centerLat,
          centerLng: input.centerLng,
          radiusMeters: input.radiusMeters,
          updatedBy: ctx.user.id,
        });

        return {
          success: true,
          message: "Zone geometry updated successfully",
        };
      } catch (error) {
        console.error("[Zone Admin API] Error updating zone geometry:", error);
        throw error;
      }
    }),

  /**
   * Assign zone admin to zone
   */
  assignZoneAdminToZone: protectedProcedure
    .input(
      z.object({
        zoneAdminId: z.number(),
        zoneId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is super admin
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Admin access required");
        }

        const assignmentId = await db.assignZoneAdminToZone({
          zoneAdminId: input.zoneAdminId,
          zoneId: input.zoneId,
          createdBy: ctx.user.id,
        });

        return {
          success: true,
          assignmentId,
          message: "Zone admin assigned to zone successfully",
        };
      } catch (error) {
        console.error("[Zone Admin API] Error assigning zone admin:", error);
        throw error;
      }
    }),

  /**
   * Get zones managed by admin
   */
  getZonesByAdmin: protectedProcedure
    .input(z.object({ zoneAdminId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const zones = await db.getZonesByAdmin(input.zoneAdminId);

        return {
          success: true,
          zones,
          total: zones.length,
        };
      } catch (error) {
        console.error("[Zone Admin API] Error fetching zones by admin:", error);
        throw error;
      }
    }),

  /**
   * Get zone audit log
   */
  getZoneAuditLog: protectedProcedure
    .input(z.object({ zoneId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const auditLog = await db.getZoneAuditLog(input.zoneId);

        return {
          success: true,
          auditLog,
          total: auditLog.length,
        };
      } catch (error) {
        console.error("[Zone Admin API] Error fetching audit log:", error);
        throw error;
      }
    }),

  /**
   * Get zone statistics
   */
  getZoneStatistics: protectedProcedure
    .input(z.object({ zoneId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const stats = await db.getZoneStatistics(input.zoneId);

        return {
          success: true,
          statistics: stats,
        };
      } catch (error) {
        console.error("[Zone Admin API] Error fetching zone statistics:", error);
        throw error;
      }
    }),

  /**
   * Check if point is within zone
   */
  isPointInZone: protectedProcedure
    .input(
      z.object({
        zoneId: z.number(),
        latitude: z.number(),
        longitude: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const geometry = await db.getZoneGeometry(input.zoneId);

        if (!geometry) {
          throw new Error("Zone geometry not found");
        }

        const isInZone = db.isPointInZone(
          input.latitude,
          input.longitude,
          geometry
        );

        return {
          success: true,
          isInZone,
        };
      } catch (error) {
        console.error("[Zone Admin API] Error checking point in zone:", error);
        throw error;
      }
    }),
});
