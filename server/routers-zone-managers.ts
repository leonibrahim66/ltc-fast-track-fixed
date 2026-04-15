import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db-zone-managers";

/**
 * Zone Manager API Routes
 * Handles zone manager assignment, driver management, and customer workflows
 */

export const zoneManagerRouter = router({
  /**
   * Assign zone manager to zone (admin only)
   */
  assignZoneManager: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        zoneId: z.number(),
        commissionRate: z.number().optional().default(10.0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is admin
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Admin access required");
        }

        const zoneManagerId = await db.assignZoneManager(input.userId, input.zoneId, input.commissionRate);

        return {
          success: true,
          zoneManagerId,
          message: "Zone manager assigned successfully",
        };
      } catch (error) {
        console.error("[Zone Manager API] Error assigning zone manager:", error);
        throw error;
      }
    }),

  /**
   * Get zone managers by zone (admin only)
   */
  getZoneManagersByZone: protectedProcedure
    .input(z.object({ zoneId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user is admin or zone manager
        if (!["admin", "zone_manager"].includes(ctx.user.role)) {
          throw new Error("Unauthorized: Admin or Zone Manager access required");
        }

        const managers = await db.getZoneManagersByZone(input.zoneId);

        return {
          success: true,
          managers,
          total: managers.length,
        };
      } catch (error) {
        console.error("[Zone Manager API] Error fetching zone managers:", error);
        throw error;
      }
    }),

  /**
   * Get zone manager details
   */
  getZoneManagerDetails: protectedProcedure
    .input(z.object({ zoneManagerId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const manager = await db.getZoneManagerDetails(input.zoneManagerId);

        if (!manager) {
          throw new Error("Zone manager not found");
        }

        return {
          success: true,
          manager,
        };
      } catch (error) {
        console.error("[Zone Manager API] Error fetching zone manager details:", error);
        throw error;
      }
    }),

  /**
   * Remove zone manager from zone (admin only)
   */
  removeZoneManager: protectedProcedure
    .input(z.object({ zoneManagerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Admin access required");
        }

        await db.removeZoneManager(input.zoneManagerId);

        return {
          success: true,
          message: "Zone manager removed successfully",
        };
      } catch (error) {
        console.error("[Zone Manager API] Error removing zone manager:", error);
        throw error;
      }
    }),

  /**
   * Assign driver to zone manager (zone manager only)
   */
  assignDriver: protectedProcedure
    .input(
      z.object({
        zoneManagerId: z.number(),
        driverId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is zone manager
        if (ctx.user.role !== "zone_manager") {
          throw new Error("Unauthorized: Zone Manager access required");
        }

        const assignmentId = await db.assignDriverToZoneManager(input.zoneManagerId, input.driverId);

        if (!assignmentId) {
          return {
            success: false,
            message: "Driver already assigned to this zone manager",
          };
        }

        return {
          success: true,
          assignmentId,
          message: "Driver assigned successfully",
        };
      } catch (error) {
        console.error("[Zone Manager API] Error assigning driver:", error);
        throw error;
      }
    }),

  /**
   * Get drivers assigned to zone manager
   */
  getAssignedDrivers: protectedProcedure
    .input(z.object({ zoneManagerId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const drivers = await db.getDriversByZoneManager(input.zoneManagerId);

        return {
          success: true,
          drivers,
          total: drivers.length,
        };
      } catch (error) {
        console.error("[Zone Manager API] Error fetching assigned drivers:", error);
        throw error;
      }
    }),

  /**
   * Remove driver from zone manager (zone manager only)
   */
  removeDriver: protectedProcedure
    .input(
      z.object({
        zoneManagerId: z.number(),
        driverId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== "zone_manager") {
          throw new Error("Unauthorized: Zone Manager access required");
        }

        await db.removeDriverFromZoneManager(input.zoneManagerId, input.driverId);

        return {
          success: true,
          message: "Driver removed successfully",
        };
      } catch (error) {
        console.error("[Zone Manager API] Error removing driver:", error);
        throw error;
      }
    }),

  /**
   * Assign customer to zone (auto-assignment based on address)
   */
  assignCustomerToZone: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        zoneId: z.number(),
        address: z.string(),
        latitude: z.number(),
        longitude: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is admin or the customer themselves
        if (ctx.user.role !== "admin" && ctx.user.id !== input.userId) {
          throw new Error("Unauthorized: Cannot assign other customers");
        }

        const assignmentId = await db.assignCustomerToZone(
          input.userId,
          input.zoneId,
          input.address,
          input.latitude,
          input.longitude
        );

        return {
          success: true,
          assignmentId,
          message: "Customer assigned to zone successfully",
        };
      } catch (error) {
        console.error("[Zone Manager API] Error assigning customer to zone:", error);
        throw error;
      }
    }),

  /**
   * Get customer's zone assignment
   */
  getCustomerZoneAssignment: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const assignment = await db.getCustomerZoneAssignment(input.userId);

        if (!assignment) {
          return {
            success: false,
            message: "Customer not assigned to any zone",
          };
        }

        return {
          success: true,
          assignment,
        };
      } catch (error) {
        console.error("[Zone Manager API] Error fetching customer zone assignment:", error);
        throw error;
      }
    }),

  /**
   * Get customers in zone (zone manager only)
   */
  getCustomersByZone: protectedProcedure
    .input(z.object({ zoneId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user is admin or zone manager
        if (!["admin", "zone_manager"].includes(ctx.user.role)) {
          throw new Error("Unauthorized: Admin or Zone Manager access required");
        }

        const customers = await db.getCustomersByZone(input.zoneId);

        return {
          success: true,
          customers,
          total: customers.length,
        };
      } catch (error) {
        console.error("[Zone Manager API] Error fetching customers by zone:", error);
        throw error;
      }
    }),

  /**
   * Get available pickups in zone (for drivers)
   */
  getAvailablePickups: protectedProcedure
    .input(z.object({ zoneId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user is driver
        if (ctx.user.role !== "driver") {
          throw new Error("Unauthorized: Driver access required");
        }

        const pickups = await db.getAvailablePickupsByZone(input.zoneId);

        return {
          success: true,
          pickups,
          total: pickups.length,
        };
      } catch (error) {
        console.error("[Zone Manager API] Error fetching available pickups:", error);
        throw error;
      }
    }),

  /**
   * Get unassigned pickups for zone manager (for manual assignment)
   */
  getUnassignedPickups: protectedProcedure
    .input(z.object({ zoneManagerId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user is zone manager
        if (ctx.user.role !== "zone_manager") {
          throw new Error("Unauthorized: Zone Manager access required");
        }

        const pickups = await db.getUnassignedPickupsByZoneManager(input.zoneManagerId);

        return {
          success: true,
          pickups,
          total: pickups.length,
        };
      } catch (error) {
        console.error("[Zone Manager API] Error fetching unassigned pickups:", error);
        throw error;
      }
    }),

  /**
   * Get pickups assigned to driver
   */
  getDriverPickups: protectedProcedure
    .input(
      z.object({
        driverId: z.number(),
        status: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Verify user is driver or admin
        if (ctx.user.role !== "driver" && ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Driver access required");
        }

        const pickups = await db.getPickupsByDriver(input.driverId, input.status);

        return {
          success: true,
          pickups,
          total: pickups.length,
        };
      } catch (error) {
        console.error("[Zone Manager API] Error fetching driver pickups:", error);
        throw error;
      }
    }),

  /**
   * Get customer's pickup history
   */
  getCustomerPickups: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user is customer or admin
        if (ctx.user.role !== "user" && ctx.user.role !== "admin" && ctx.user.id !== input.customerId) {
          throw new Error("Unauthorized: Cannot view other customers' pickups");
        }

        const pickups = await db.getPickupsByCustomer(input.customerId);

        return {
          success: true,
          pickups,
          total: pickups.length,
        };
      } catch (error) {
        console.error("[Zone Manager API] Error fetching customer pickups:", error);
        throw error;
      }
    }),

  /**
   * Manually assign pickup to driver (zone manager only)
   */
  assignPickupToDriver: protectedProcedure
    .input(
      z.object({
        pickupId: z.number(),
        driverId: z.number(),
        zoneManagerId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is zone manager
        if (ctx.user.role !== "zone_manager") {
          throw new Error("Unauthorized: Zone Manager access required");
        }

        const assignmentId = await db.assignPickupToDriver(input.pickupId, input.driverId, input.zoneManagerId);

        return {
          success: true,
          assignmentId,
          message: "Pickup assigned to driver successfully",
        };
      } catch (error) {
        console.error("[Zone Manager API] Error assigning pickup to driver:", error);
        throw error;
      }
    }),

  /**
   * Update pickup status (driver or zone manager)
   */
  updatePickupStatus: protectedProcedure
    .input(
      z.object({
        pickupId: z.number(),
        status: z.enum(["accepted", "assigned", "arrived", "completed", "cancelled"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is driver or zone manager
        if (!["driver", "zone_manager"].includes(ctx.user.role)) {
          throw new Error("Unauthorized: Driver or Zone Manager access required");
        }

        await db.updateGarbagePickupStatus(input.pickupId, input.status);

        return {
          success: true,
          message: `Pickup status updated to ${input.status}`,
        };
      } catch (error) {
        console.error("[Zone Manager API] Error updating pickup status:", error);
        throw error;
      }
    }),
});
