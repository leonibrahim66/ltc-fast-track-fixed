import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import * as db from "./db";

export const bookingsRouter = router({
  /**
   * Get all available bookings (pending status)
   * Accessible to drivers only
   */
  getAvailable: protectedProcedure.query(async () => {
    return db.getAvailableBookings();
  }),

  /**
   * Get bookings assigned to a specific driver
   */
  getByDriver: protectedProcedure.query(async ({ ctx }) => {
    return db.getBookingsByDriver(ctx.user.id);
  }),

  /**
   * Get a single booking by ID
   */
  getById: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .query(async ({ input }) => {
      return db.getBookingById(input.bookingId);
    }),

  /**
   * Accept a booking (driver accepts the job)
   */
  accept: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await db.acceptBooking(input.bookingId, ctx.user.id);
        return { success: true, message: "Booking accepted successfully" };
      } catch (error) {
        console.error("Error accepting booking:", error);
        throw new Error("Failed to accept booking");
      }
    }),

  /**
   * Reject a booking (driver rejects the job)
   */
  reject: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await db.rejectBooking(input.bookingId);
        return { success: true, message: "Booking rejected successfully" };
      } catch (error) {
        console.error("Error rejecting booking:", error);
        throw new Error("Failed to reject booking");
      }
    }),

  /**
   * Update booking status (in-progress, completed, cancelled)
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        bookingId: z.number(),
        status: z.enum(["in-progress", "completed", "cancelled"]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await db.updateBookingStatus(input.bookingId, input.status);
        return { success: true, message: `Booking status updated to ${input.status}` };
      } catch (error) {
        console.error("Error updating booking status:", error);
        throw new Error("Failed to update booking status");
      }
    }),

  /**
   * Get completed bookings for a driver
   */
  getCompleted: protectedProcedure.query(async ({ ctx }) => {
    return db.getCompletedBookingsByDriver(ctx.user.id);
  }),

  /**
   * Get all bookings (admin only)
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is admin
    if (ctx.user.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }
    return db.getAllBookings();
  }),
});
