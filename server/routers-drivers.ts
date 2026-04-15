import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { driverProfiles, driverDocuments, driverWallets, transportJobs, walletTransactions, driverWithdrawals, driverRatings, driverActivityLog } from "../drizzle/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";

const VehicleTypeEnum = z.enum(["motorbike", "van", "pickup", "truck", "trailer"]);
const JobStatusEnum = z.enum(["pending", "accepted", "arrived", "picked_up", "in_transit", "delivered", "completed", "cancelled", "rejected"]);
const WithdrawalMethodEnum = z.enum(["mobile_money", "bank_transfer"]);

export const driversRouter = router({
  /**
   * Register a new driver
   */
  register: publicProcedure
    .input(z.object({
      fullName: z.string().min(2),
      phone: z.string().min(10),
      email: z.string().email(),
      vehicleType: VehicleTypeEnum,
      plateNumber: z.string().min(3),
      driversLicenseUrl: z.string(),
      idDocumentUrl: z.string(),
      vehiclePhotoUrl: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [profile] = await db.insert(driverProfiles).values({
        userId: ctx.user?.id || 0,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        vehicleType: input.vehicleType,
        plateNumber: input.plateNumber,
        isApproved: false,
        isOnline: false,
        isSuspended: false,
      });

      const driverId = (profile as any).insertId;

      await db.insert(driverDocuments).values([
        { driverId, documentType: "drivers_license", fileUrl: input.driversLicenseUrl },
        { driverId, documentType: "nrc_id", fileUrl: input.idDocumentUrl },
        { driverId, documentType: "vehicle_photo", fileUrl: input.vehiclePhotoUrl },
      ]);

      await db.insert(driverWallets).values({
        driverId,
        balance: "0.00",
        totalEarnings: "0.00",
        totalWithdrawn: "0.00",
        pendingWithdrawal: "0.00",
      });

      await db.insert(driverActivityLog).values({
        driverId,
        activityType: "document_uploaded",
        details: "Driver registration submitted",
      });

      return { success: true, driverId, message: "Registration submitted for review" };
    }),

  /**
   * Get driver profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const [profile] = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, ctx.user.id))
      .limit(1);

    if (!profile) return null;

    const [wallet] = await db
      .select()
      .from(driverWallets)
      .where(eq(driverWallets.driverId, profile.id))
      .limit(1);

    return { ...profile, wallet };
  }),

  /**
   * Toggle online/offline status
   */
  toggleOnline: protectedProcedure
    .input(z.object({ isOnline: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, ctx.user.id))
        .limit(1);

      if (!profile) throw new Error("Driver profile not found");
      if (!profile.isApproved) throw new Error("Your account is pending approval");
      if (profile.isSuspended) throw new Error("Your account has been suspended");

      await db
        .update(driverProfiles)
        .set({ isOnline: input.isOnline })
        .where(eq(driverProfiles.id, profile.id));

      await db.insert(driverActivityLog).values({
        driverId: profile.id,
        activityType: input.isOnline ? "online" : "offline",
      });

      return { success: true, isOnline: input.isOnline };
    }),

  /**
   * Get driver stats
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const [profile] = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, ctx.user.id))
      .limit(1);

    if (!profile) return null;

    const [wallet] = await db
      .select()
      .from(driverWallets)
      .where(eq(driverWallets.driverId, profile.id))
      .limit(1);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEarnings = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.driverId, profile.id),
        eq(walletTransactions.type, "earning"),
        gte(walletTransactions.createdAt, today)
      ));

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEarnings = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.driverId, profile.id),
        eq(walletTransactions.type, "earning"),
        gte(walletTransactions.createdAt, weekStart)
      ));

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEarnings = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.driverId, profile.id),
        eq(walletTransactions.type, "earning"),
        gte(walletTransactions.createdAt, monthStart)
      ));

    return {
      walletBalance: wallet?.balance || "0.00",
      totalEarnings: wallet?.totalEarnings || "0.00",
      totalCompletedJobs: profile.totalCompletedJobs || 0,
      averageRating: profile.averageRating || "0.00",
      totalRatings: profile.totalRatings || 0,
      earningsToday: todayEarnings[0]?.total || "0.00",
      earningsWeek: weekEarnings[0]?.total || "0.00",
      earningsMonth: monthEarnings[0]?.total || "0.00",
    };
  }),

  /**
   * Get available jobs
   */
  getAvailableJobs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const [profile] = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, ctx.user.id))
      .limit(1);

    if (!profile || !profile.isApproved || profile.isSuspended) return [];

    const jobs = await db
      .select()
      .from(transportJobs)
      .where(eq(transportJobs.status, "pending"))
      .orderBy(desc(transportJobs.createdAt))
      .limit(50);

    return jobs;
  }),

  /**
   * Accept a job
   */
  acceptJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, ctx.user.id))
        .limit(1);

      if (!profile) throw new Error("Driver profile not found");
      if (!profile.isOnline) throw new Error("You must be online to accept jobs");

      const [job] = await db
        .select()
        .from(transportJobs)
        .where(and(
          eq(transportJobs.id, input.jobId),
          eq(transportJobs.status, "pending")
        ))
        .limit(1);

      if (!job) throw new Error("Job is no longer available");

      await db
        .update(transportJobs)
        .set({
          driverId: profile.id,
          status: "accepted",
          acceptedAt: new Date(),
        })
        .where(eq(transportJobs.id, input.jobId));

      await db.insert(driverActivityLog).values({
        driverId: profile.id,
        activityType: "job_accepted",
        jobId: input.jobId,
      });

      return { success: true, message: "Job accepted successfully" };
    }),

  /**
   * Reject a job
   */
  rejectJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, ctx.user.id))
        .limit(1);

      if (!profile) throw new Error("Driver profile not found");

      await db.insert(driverActivityLog).values({
        driverId: profile.id,
        activityType: "job_rejected",
        jobId: input.jobId,
      });

      return { success: true, message: "Job rejected" };
    }),

  /**
   * Update job status
   */
  updateJobStatus: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      status: JobStatusEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, ctx.user.id))
        .limit(1);

      if (!profile) throw new Error("Driver profile not found");

      const updateData: any = { status: input.status };

      switch (input.status) {
        case "arrived":
          updateData.arrivedAt = new Date();
          break;
        case "picked_up":
          updateData.pickedUpAt = new Date();
          break;
        case "delivered":
          updateData.deliveredAt = new Date();
          break;
        case "completed":
          updateData.completedAt = new Date();
          break;
        case "cancelled":
          updateData.cancelledAt = new Date();
          break;
      }

      await db
        .update(transportJobs)
        .set(updateData)
        .where(and(
          eq(transportJobs.id, input.jobId),
          eq(transportJobs.driverId, profile.id)
        ));

      if (input.status === "completed") {
        const [job] = await db
          .select()
          .from(transportJobs)
          .where(eq(transportJobs.id, input.jobId))
          .limit(1);

        if (job && job.driverEarnings) {
          const [wallet] = await db
            .select()
            .from(driverWallets)
            .where(eq(driverWallets.driverId, profile.id))
            .limit(1);

          if (wallet) {
            const newBalance = parseFloat(wallet.balance as string) + parseFloat(job.driverEarnings as string);
            const newTotalEarnings = parseFloat(wallet.totalEarnings as string) + parseFloat(job.driverEarnings as string);

            await db
              .update(driverWallets)
              .set({
                balance: newBalance.toFixed(2),
                totalEarnings: newTotalEarnings.toFixed(2),
              })
              .where(eq(driverWallets.driverId, profile.id));

            await db.insert(walletTransactions).values({
              driverId: profile.id,
              jobId: input.jobId,
              type: "earning",
              amount: job.driverEarnings,
              balanceAfter: newBalance.toFixed(2),
              description: `Earnings from job #${input.jobId}`,
            });
          }

          await db
            .update(driverProfiles)
            .set({
              totalCompletedJobs: sql`${driverProfiles.totalCompletedJobs} + 1`,
            })
            .where(eq(driverProfiles.id, profile.id));
        }

        await db.insert(driverActivityLog).values({
          driverId: profile.id,
          activityType: "job_completed",
          jobId: input.jobId,
        });
      }

      return { success: true, message: `Job status updated to ${input.status}` };
    }),

  /**
   * Get active job
   */
  getActiveJob: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const [profile] = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, ctx.user.id))
      .limit(1);

    if (!profile) return null;

    const [job] = await db
      .select()
      .from(transportJobs)
      .where(and(
        eq(transportJobs.driverId, profile.id),
        sql`${transportJobs.status} IN ('accepted', 'arrived', 'picked_up', 'in_transit')`
      ))
      .orderBy(desc(transportJobs.acceptedAt))
      .limit(1);

    return job || null;
  }),

  /**
   * Get completed jobs
   */
  getCompletedJobs: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, ctx.user.id))
        .limit(1);

      if (!profile) return [];

      const jobs = await db
        .select()
        .from(transportJobs)
        .where(and(
          eq(transportJobs.driverId, profile.id),
          eq(transportJobs.status, "completed")
        ))
        .orderBy(desc(transportJobs.completedAt))
        .limit(input.limit)
        .offset(input.offset);

      return jobs;
    }),

  /**
   * Get transactions
   */
  getTransactions: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, ctx.user.id))
        .limit(1);

      if (!profile) return [];

      const transactions = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.driverId, profile.id))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return transactions;
    }),

  /**
   * Request withdrawal
   */
  requestWithdrawal: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
      method: WithdrawalMethodEnum,
      accountNumber: z.string().min(5),
      accountName: z.string().optional(),
      bankName: z.string().optional(),
      mobileProvider: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, ctx.user.id))
        .limit(1);

      if (!profile) throw new Error("Driver profile not found");

      const [wallet] = await db
        .select()
        .from(driverWallets)
        .where(eq(driverWallets.driverId, profile.id))
        .limit(1);

      if (!wallet) throw new Error("Wallet not found");

      const balance = parseFloat(wallet.balance as string);
      if (input.amount > balance) throw new Error("Insufficient balance");

      await db.insert(driverWithdrawals).values({
        driverId: profile.id,
        amount: input.amount.toFixed(2),
        withdrawalMethod: input.method,
        accountNumber: input.accountNumber,
        accountName: input.accountName,
        bankName: input.bankName,
        mobileProvider: input.mobileProvider,
        status: "pending",
      });

      const newPending = parseFloat(wallet.pendingWithdrawal as string) + input.amount;
      const newBalance = balance - input.amount;

      await db
        .update(driverWallets)
        .set({
          balance: newBalance.toFixed(2),
          pendingWithdrawal: newPending.toFixed(2),
        })
        .where(eq(driverWallets.driverId, profile.id));

      await db.insert(walletTransactions).values({
        driverId: profile.id,
        type: "withdrawal",
        amount: (-input.amount).toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        description: `Withdrawal request via ${input.method}`,
      });

      await db.insert(driverActivityLog).values({
        driverId: profile.id,
        activityType: "withdrawal_requested",
        details: `Withdrawal of K${input.amount} via ${input.method}`,
      });

      return { success: true, message: "Withdrawal request submitted" };
    }),

  /**
   * Get withdrawals
   */
  getWithdrawals: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, ctx.user.id))
        .limit(1);

      if (!profile) return [];

      const withdrawals = await db
        .select()
        .from(driverWithdrawals)
        .where(eq(driverWithdrawals.driverId, profile.id))
        .orderBy(desc(driverWithdrawals.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return withdrawals;
    }),

  /**
   * Get ratings
   */
  getRatings: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, ctx.user.id))
        .limit(1);

      if (!profile) return [];

      const ratings = await db
        .select()
        .from(driverRatings)
        .where(eq(driverRatings.driverId, profile.id))
        .orderBy(desc(driverRatings.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return ratings;
    }),

  /**
   * Admin: Get all driver profiles
   */
  adminGetAllDrivers: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).optional().default(200) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(driverProfiles)
        .orderBy(desc(driverProfiles.createdAt))
        .limit(input.limit);
    }),

  /**
   * Admin: Get driver activity log (most recent first)
   */
  adminGetActivityLog: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).optional().default(200) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(driverActivityLog)
        .orderBy(desc(driverActivityLog.createdAt))
        .limit(input.limit);
    }),
});
