import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  getCustomerWallet,
  getWalletTransactions,
  processRecharge,
  processWithdrawal,
  addReferralBonus,
  deductPayment,
} from "./db-customer-wallet";
import {
  getLinkedAccount,
  createLinkedAccount,
  updateLinkedAccount,
  unlinkAccount,
  verifyWithdrawalPin,
} from "./db-linked-accounts";

// Recharge schema
const RechargeSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: z.string().optional(),
});

// Withdrawal schema
const WithdrawalSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  withdrawalPin: z.string().min(4, "PIN must be at least 4 digits"),
});

// Link account schema
const LinkAccountSchema = z.object({
  provider: z.enum(["mtn_momo", "airtel_money", "zamtel_money"]),
  phoneNumber: z.string().min(9, "Phone number must be at least 9 digits"),
  withdrawalPin: z.string().min(4, "PIN must be at least 4 digits"),
});

// Referral credit schema
const ReferralCreditSchema = z.object({
  userId: z.number(),
  amount: z.number().positive(),
  referrerName: z.string(),
});

// Payment deduction schema
const PaymentDeductionSchema = z.object({
  userId: z.number(),
  amount: z.number().positive(),
  description: z.string(),
  referenceId: z.string().optional(),
});

export const walletRouter = router({
  /**
   * Get wallet balance for current user
   */
  getBalance: publicProcedure.query(async ({ ctx }) => {
    console.log("[Wallet] Fetching wallet balance");

    // TODO: Get userId from authenticated session
    const userId = 1; // Mock user ID for development

    const wallet = await getCustomerWallet(userId);

    if (!wallet) {
      return {
        success: false,
        error: "Wallet not found",
      };
    }

    return {
      success: true,
      data: {
        totalBalance: parseFloat(wallet.totalBalance),
        rechargedBalance: parseFloat(wallet.rechargedBalance),
        referralBalance: parseFloat(wallet.referralBalance),
      },
    };
  }),

  /**
   * Get wallet transaction history
   */
  getTransactions: publicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      console.log("[Wallet] Fetching transaction history");

      // TODO: Get userId from authenticated session
      const userId = 1; // Mock user ID for development

      const transactions = await getWalletTransactions(userId, input.limit);

      return {
        success: true,
        data: transactions.map((t) => ({
          id: t.id.toString(),
          type: t.type,
          amount: parseFloat(t.amount),
          status: t.status,
          description: t.description || "",
          date: t.createdAt.toISOString().split("T")[0],
          referenceId: t.referenceId,
        })),
      };
    }),

  /**
   * Initiate wallet recharge
   */
  recharge: publicProcedure
    .input(RechargeSchema)
    .mutation(async ({ ctx, input }) => {
      console.log("[Wallet] Processing recharge:", input.amount);

      // TODO: Get userId from authenticated session
      const userId = 1; // Mock user ID for development

      // TODO: Integrate with payment gateway
      // For now, we'll create a pending transaction
      // In production, this would redirect to payment gateway
      // and the transaction would be completed via webhook

      const referenceId = `RECHARGE_${Date.now()}`;

      try {
        await processRecharge(
          userId,
          input.amount,
          referenceId,
          `Wallet recharge via ${input.paymentMethod || "Mobile Money"}`
        );

        return {
          success: true,
          message: "Recharge successful",
          data: {
            referenceId,
            amount: input.amount,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || "Recharge failed",
        };
      }
    }),

  /**
   * Request withdrawal
   */
  withdraw: publicProcedure
    .input(WithdrawalSchema)
    .mutation(async ({ ctx, input }) => {
      console.log("[Wallet] Processing withdrawal:", input.amount);

      // TODO: Get userId from authenticated session
      const userId = 1; // Mock user ID for development

      try {
        // Check if user has linked account
        const linkedAccount = await getLinkedAccount(userId);
        if (!linkedAccount) {
          return {
            success: false,
            error: "No linked account found. Please link your mobile money account first.",
          };
        }

        // Verify withdrawal PIN
        const isPinValid = await verifyWithdrawalPin(userId, input.withdrawalPin);
        if (!isPinValid) {
          return {
            success: false,
            error: "Invalid withdrawal PIN. Please try again.",
          };
        }

        // Process withdrawal to linked account
        await processWithdrawal(
          userId,
          input.amount,
          `${linkedAccount.provider}: ${linkedAccount.phoneNumber}`,
          `Withdrawal to ${linkedAccount.phoneNumber}`
        );

        return {
          success: true,
          message: "Withdrawal request submitted successfully. It will be processed within 24-48 hours.",
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || "Withdrawal failed",
        };
      }
    }),

  /**
   * Credit referral bonus (admin only)
   */
  creditReferralBonus: publicProcedure
    .input(ReferralCreditSchema)
    .mutation(async ({ ctx, input }) => {
      console.log("[Wallet] Crediting referral bonus:", input);

      // TODO: Add admin authentication check

      try {
        await addReferralBonus(input.userId, input.amount, input.referrerName);

        return {
          success: true,
          message: "Referral bonus credited successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || "Failed to credit referral bonus",
        };
      }
    }),

  /**
   * Deduct payment from wallet (for services)
   */
  deductPayment: publicProcedure
    .input(PaymentDeductionSchema)
    .mutation(async ({ ctx, input }) => {
      console.log("[Wallet] Deducting payment:", input);

      try {
        await deductPayment(
          input.userId,
          input.amount,
          input.description,
          input.referenceId
        );

        return {
          success: true,
          message: "Payment deducted successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || "Payment deduction failed",
        };
      }
    }),

  /**
   * Get linked account for current user
   */
  getLinkedAccount: publicProcedure.query(async ({ ctx }) => {
    console.log("[Wallet] Fetching linked account");

    // TODO: Get userId from authenticated session
    const userId = 1; // Mock user ID for development

    const linkedAccount = await getLinkedAccount(userId);

    if (!linkedAccount) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        provider: linkedAccount.provider,
        phoneNumber: linkedAccount.phoneNumber,
        status: linkedAccount.status,
      },
    };
  }),

  /**
   * Link mobile money account
   */
  linkAccount: publicProcedure
    .input(LinkAccountSchema)
    .mutation(async ({ ctx, input }) => {
      console.log("[Wallet] Linking account:", input.provider, input.phoneNumber);

      // TODO: Get userId from authenticated session
      const userId = 1; // Mock user ID for development

      try {
        await createLinkedAccount(
          userId,
          input.provider,
          input.phoneNumber,
          input.withdrawalPin
        );

        return {
          success: true,
          message: "Account linked successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || "Failed to link account",
        };
      }
    }),

  /**
   * Unlink mobile money account
   */
  unlinkAccount: publicProcedure.mutation(async ({ ctx }) => {
    console.log("[Wallet] Unlinking account");

    // TODO: Get userId from authenticated session
    const userId = 1; // Mock user ID for development

    try {
      await unlinkAccount(userId);

      return {
        success: true,
        message: "Account unlinked successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to unlink account",
      };
    }
  }),
});
