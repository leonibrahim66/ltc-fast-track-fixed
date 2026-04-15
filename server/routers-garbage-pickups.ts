import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db-zone-managers";

/**
 * Garbage Pickup API Routes
 * Handles customer pickup requests, driver acceptance, and completion
 */

export const garbagePickupRouter = router({
  /**
   * Customer creates garbage pickup request
   */
  createPickup: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        address: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is customer or admin
        if (ctx.user.role !== "user" && ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Customer access required");
        }

        // Get customer's zone assignment
        const zoneAssignment = await db.getCustomerZoneAssignment(input.customerId);

        if (!zoneAssignment) {
          throw new Error("Customer not assigned to any zone");
        }

        // Create garbage pickup
        const pickupId = await db.createGarbagePickup({
          customerId: input.customerId,
          zoneId: zoneAssignment.zoneId,
          address: input.address,
          latitude: input.latitude,
          longitude: input.longitude,
          status: "pending",
          notes: input.notes,
          scheduledTime: new Date(),
        });

        return {
          success: true,
          pickupId,
          message: "Pickup request created successfully",
          zoneId: zoneAssignment.zoneId,
        };
      } catch (error) {
        console.error("[Garbage Pickup API] Error creating pickup:", error);
        throw error;
      }
    }),

  /**
   * Get pickup details
   */
  getPickup: protectedProcedure
    .input(z.object({ pickupId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const pickup = await db.getGarbagePickup(input.pickupId);

        if (!pickup) {
          throw new Error("Pickup not found");
        }

        return {
          success: true,
          pickup,
        };
      } catch (error) {
        console.error("[Garbage Pickup API] Error fetching pickup:", error);
        throw error;
      }
    }),

  /**
   * Driver accepts pickup (auto-assignment)
   */
  acceptPickup: protectedProcedure
    .input(
      z.object({
        pickupId: z.number(),
        driverId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is driver
        if (ctx.user.role !== "driver") {
          throw new Error("Unauthorized: Driver access required");
        }

        // Get pickup details
        const pickup = await db.getGarbagePickup(input.pickupId);

        if (!pickup) {
          throw new Error("Pickup not found");
        }

        if (pickup.status !== "pending") {
          throw new Error(`Pickup is already ${pickup.status}`);
        }

        // Assign pickup to driver (auto-assignment, no zone manager)
        const assignmentId = await db.assignPickupToDriver(input.pickupId, input.driverId);

        // Update pickup status to accepted
        await db.updateGarbagePickupStatus(input.pickupId, "accepted");

        return {
          success: true,
          assignmentId,
          message: "Pickup accepted successfully",
        };
      } catch (error) {
        console.error("[Garbage Pickup API] Error accepting pickup:", error);
        throw error;
      }
    }),

  /**
   * Driver marks pickup as arrived
   */
  markArrived: protectedProcedure
    .input(z.object({ pickupId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is driver
        if (ctx.user.role !== "driver") {
          throw new Error("Unauthorized: Driver access required");
        }

        const pickup = await db.getGarbagePickup(input.pickupId);

        if (!pickup) {
          throw new Error("Pickup not found");
        }

        if (!["accepted", "assigned"].includes(pickup.status)) {
          throw new Error(`Cannot mark arrived - pickup status is ${pickup.status}`);
        }

        await db.updateGarbagePickupStatus(input.pickupId, "arrived");

        return {
          success: true,
          message: "Pickup marked as arrived",
        };
      } catch (error) {
        console.error("[Garbage Pickup API] Error marking pickup arrived:", error);
        throw error;
      }
    }),

  /**
   * Driver completes pickup
   */
  completePickup: protectedProcedure
    .input(
      z.object({
        pickupId: z.number(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is driver
        if (ctx.user.role !== "driver") {
          throw new Error("Unauthorized: Driver access required");
        }

        const pickup = await db.getGarbagePickup(input.pickupId);

        if (!pickup) {
          throw new Error("Pickup not found");
        }

        if (pickup.status !== "arrived") {
          throw new Error(`Cannot complete - pickup status is ${pickup.status}`);
        }

        await db.updateGarbagePickupStatus(input.pickupId, "completed");

        return {
          success: true,
          message: "Pickup completed successfully",
        };
      } catch (error) {
        console.error("[Garbage Pickup API] Error completing pickup:", error);
        throw error;
      }
    }),

  /**
   * Customer cancels pickup
   */
  cancelPickup: protectedProcedure
    .input(
      z.object({
        pickupId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is customer or admin
        if (ctx.user.role !== "user" && ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Customer access required");
        }

        const pickup = await db.getGarbagePickup(input.pickupId);

        if (!pickup) {
          throw new Error("Pickup not found");
        }

        if (["completed", "cancelled"].includes(pickup.status)) {
          throw new Error(`Cannot cancel - pickup is already ${pickup.status}`);
        }

        await db.updateGarbagePickupStatus(input.pickupId, "cancelled");

        return {
          success: true,
          message: "Pickup cancelled successfully",
        };
      } catch (error) {
        console.error("[Garbage Pickup API] Error cancelling pickup:", error);
        throw error;
      }
    }),

  /**
   * Get available pickups for driver (in their zone)
   */
  getAvailablePickupsForDriver: protectedProcedure
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
        console.error("[Garbage Pickup API] Error fetching available pickups:", error);
        throw error;
      }
    }),

  /**
   * Get driver's active pickups
   */
  getDriverActivePickups: protectedProcedure
    .input(z.object({ driverId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user is driver or admin
        if (ctx.user.role !== "driver" && ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Driver access required");
        }

        const pickups = await db.getPickupsByDriver(input.driverId, "accepted");
        const assignedPickups = await db.getPickupsByDriver(input.driverId, "assigned");
        const arrivedPickups = await db.getPickupsByDriver(input.driverId, "arrived");

        const allPickups = [...pickups, ...assignedPickups, ...arrivedPickups];

        return {
          success: true,
          pickups: allPickups,
          total: allPickups.length,
        };
      } catch (error) {
        console.error("[Garbage Pickup API] Error fetching driver active pickups:", error);
        throw error;
      }
    }),

  /**
   * Get driver's completed pickups
   */
  getDriverCompletedPickups: protectedProcedure
    .input(z.object({ driverId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user is driver or admin
        if (ctx.user.role !== "driver" && ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Driver access required");
        }

        const pickups = await db.getPickupsByDriver(input.driverId, "completed");

        return {
          success: true,
          pickups,
          total: pickups.length,
        };
      } catch (error) {
        console.error("[Garbage Pickup API] Error fetching driver completed pickups:", error);
        throw error;
      }
    }),

  /**
   * Get customer's pickup history
   */
  getCustomerPickupHistory: protectedProcedure
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
        console.error("[Garbage Pickup API] Error fetching customer pickup history:", error);
        throw error;
      }
    }),

  /**
   * Get unassigned pickups for zone manager
   */
  getUnassignedPickupsForManager: protectedProcedure
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
        console.error("[Garbage Pickup API] Error fetching unassigned pickups:", error);
        throw error;
      }
    }),

  /**
   * Zone manager manually assigns pickup to driver
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

        const pickup = await db.getGarbagePickup(input.pickupId);

        if (!pickup) {
          throw new Error("Pickup not found");
        }

        if (pickup.status !== "pending") {
          throw new Error(`Cannot assign - pickup is already ${pickup.status}`);
        }

        // Verify driver is assigned to this zone manager
        const drivers = await db.getDriversByZoneManager(input.zoneManagerId);
        const driverExists = drivers.some((d: any) => d.id === input.driverId);

        if (!driverExists) {
          throw new Error("Driver is not assigned to this zone manager");
        }

        // Assign pickup to driver
        const assignmentId = await db.assignPickupToDriver(input.pickupId, input.driverId, input.zoneManagerId);

        return {
          success: true,
          assignmentId,
          message: "Pickup assigned to driver successfully",
        };
      } catch (error) {
        console.error("[Garbage Pickup API] Error assigning pickup to driver:", error);
        throw error;
      }
    }),
});
