import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { bookingsRouter } from "./routers-bookings";
import { driversRouter } from "./routers-drivers";
import {
  getAllUsers,
  getUserNotifications,
  createUserNotification,
  markUserNotificationRead,
  markAllUserNotificationsRead,
} from "./db";
import { collectorRouter } from "./routers-collector";
import { zoneRouter } from "./routers-zone";
import { walletRouter } from "./routers-wallet";
import { paymentRouter } from "./routers-payment";
import { zoneManagerRouter } from "./routers-zone-managers";
import { garbagePickupRouter } from "./routers-garbage-pickups";
import { zoneAdminRouter } from "./routers-zone-admin";

// Payment status enum
const PaymentStatusEnum = z.enum([
  "pending",
  "processing", 
  "successful",
  "failed",
  "cancelled",
  "expired",
  "refunded",
]);

// Payment provider enum
const PaymentProviderEnum = z.enum([
  "mtn_momo",
  "airtel_money",
  "zamtel_money",
  "bank_transfer",
  "card",
]);

// Payment callback schema
const PaymentCallbackSchema = z.object({
  transactionId: z.string(),
  externalId: z.string().optional(),
  status: PaymentStatusEnum,
  amount: z.number(),
  currency: z.string().default("ZMW"),
  provider: PaymentProviderEnum,
  timestamp: z.string(),
  signature: z.string().optional(),
  // Provider-specific fields
  phoneNumber: z.string().optional(),
  reference: z.string().optional(),
  failureReason: z.string().optional(),
});

// Payment request schema
const PaymentRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default("ZMW"),
  provider: PaymentProviderEnum,
  phoneNumber: z.string(),
  reference: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  bookings: bookingsRouter,
  drivers: driversRouter,
  collector: collectorRouter,
  zone: zoneRouter,
  zoneAdmin: zoneAdminRouter,
  zoneManager: zoneManagerRouter,
  garbagePickup: garbagePickupRouter,
  wallet: walletRouter,
  paymentService: paymentRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Payment API routes
  payments: router({
    /**
     * Initiate a payment request
     * This is called from the mobile app to start a payment
     */
    initiate: publicProcedure
      .input(PaymentRequestSchema)
      .mutation(async ({ input }) => {
        // Log the payment request
        console.log("[Payments] Initiating payment:", {
          provider: input.provider,
          amount: input.amount,
          reference: input.reference,
        });

        // Generate transaction ID
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        // In production, this would call the actual payment provider API
        // For now, return a pending status
        return {
          success: true,
          transactionId,
          status: "pending" as const,
          message: "Payment request initiated. Please complete payment on your phone.",
          provider: input.provider,
          amount: input.amount,
          currency: input.currency,
          reference: input.reference,
          timestamp: new Date().toISOString(),
        };
      }),

    /**
     * Check payment status
     */
    status: publicProcedure
      .input(z.object({
        transactionId: z.string(),
        provider: PaymentProviderEnum,
      }))
      .query(async ({ input }) => {
        console.log("[Payments] Checking status:", input.transactionId);

        // In production, this would query the payment provider API
        // For now, return mock status
        return {
          transactionId: input.transactionId,
          status: "pending" as const,
          provider: input.provider,
          timestamp: new Date().toISOString(),
        };
      }),

    /**
     * MTN MoMo webhook callback
     * Called by MTN when payment status changes
     */
    mtnCallback: publicProcedure
      .input(PaymentCallbackSchema)
      .mutation(async ({ input }) => {
        console.log("[Payments] MTN MoMo callback received:", {
          transactionId: input.transactionId,
          status: input.status,
          amount: input.amount,
        });

        // Verify the callback signature (implement based on MTN docs)
        // const isValid = verifyMtnSignature(input);

        // Update payment status in database
        // await updatePaymentStatus(input.transactionId, input.status);

        // Send notification to user
        // await notifyUser(input.transactionId, input.status);

        return {
          success: true,
          message: "Callback processed",
          transactionId: input.transactionId,
        };
      }),

    /**
     * Airtel Money webhook callback
     * Called by Airtel when payment status changes
     */
    airtelCallback: publicProcedure
      .input(PaymentCallbackSchema)
      .mutation(async ({ input }) => {
        console.log("[Payments] Airtel Money callback received:", {
          transactionId: input.transactionId,
          status: input.status,
          amount: input.amount,
        });

        // Verify the callback signature (implement based on Airtel docs)
        // const isValid = verifyAirtelSignature(input);

        // Update payment status in database
        // await updatePaymentStatus(input.transactionId, input.status);

        // Send notification to user
        // await notifyUser(input.transactionId, input.status);

        return {
          success: true,
          message: "Callback processed",
          transactionId: input.transactionId,
        };
      }),

    /**
     * Generic webhook callback (for other providers)
     */
    genericCallback: publicProcedure
      .input(PaymentCallbackSchema)
      .mutation(async ({ input }) => {
        console.log("[Payments] Generic callback received:", {
          provider: input.provider,
          transactionId: input.transactionId,
          status: input.status,
        });

        return {
          success: true,
          message: "Callback processed",
          transactionId: input.transactionId,
        };
      }),

    /**
     * Get payment receiver numbers
     */
    getReceivers: publicProcedure.query(() => {
      return {
        mtn_momo: "+260960819993",
        airtel_money: "20158560",
        zamtel_money: "", // To be added
      };
    }),
  }),
  /**
   * Notifications router — customer in-app notifications
   */
  notifications: router({
    /**
     * Fetch all notifications for a user (most recent first)
     */
    getAll: publicProcedure
      .input(z.object({ userId: z.string(), limit: z.number().int().min(1).max(200).optional().default(100) }))
      .query(async ({ input }) => {
        const rows = await getUserNotifications(input.userId, input.limit);
        // Sort newest first
        return [...rows].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }),

    /**
     * Create a new notification for a user
     */
    create: publicProcedure
      .input(z.object({
        userId: z.string(),
        type: z.enum(["pickup_update","driver_accepted","driver_arriving","pickup_completed","payment","subscription","system","support"]),
        title: z.string(),
        body: z.string(),
        data: z.string().optional(),
        pickupId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createUserNotification(input);
        return { success: true, id };
      }),

    /**
     * Mark a single notification as read
     */
    markRead: publicProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await markUserNotificationRead(input.id);
        return { success: true };
      }),

    /**
     * Mark all notifications as read for a user
     */
    markAllRead: publicProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ input }) => {
        await markAllUserNotificationsRead(input.userId);
        return { success: true };
      }),
  }),

  /**
   * Admin router — all admin-level data queries
   */
  admin: router({
    getAllUsers: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).optional().default(200) }))
      .query(async ({ input }) => getAllUsers(input.limit)),
  }),
});

export type AppRouter = typeof appRouter;
