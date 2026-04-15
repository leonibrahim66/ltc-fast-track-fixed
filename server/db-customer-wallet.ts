import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  customerWallets,
  customerWalletTransactions,
  InsertCustomerWallet,
  InsertCustomerWalletTransaction,
} from "../drizzle/schema";

/**
 * CUSTOMER WALLET QUERIES
 */

export async function getCustomerWallet(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db
      .select()
      .from(customerWallets)
      .where(eq(customerWallets.userId, userId))
      .limit(1);

    if (result.length > 0) {
      return result[0];
    }

    // Create wallet if it doesn't exist
    await db.insert(customerWallets).values({
      userId,
      totalBalance: "0.00",
      rechargedBalance: "0.00",
      referralBalance: "0.00",
    });

    const newWallet = await db
      .select()
      .from(customerWallets)
      .where(eq(customerWallets.userId, userId))
      .limit(1);

    return newWallet.length > 0 ? newWallet[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get customer wallet:", error);
    return undefined;
  }
}

export async function updateWalletBalance(
  userId: number,
  totalBalance: string,
  rechargedBalance: string,
  referralBalance: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db
      .update(customerWallets)
      .set({
        totalBalance,
        rechargedBalance,
        referralBalance,
      })
      .where(eq(customerWallets.userId, userId));

    return true;
  } catch (error) {
    console.error("[Database] Failed to update wallet balance:", error);
    throw error;
  }
}

/**
 * WALLET TRANSACTION QUERIES
 */

export async function createWalletTransaction(
  transactionData: InsertCustomerWalletTransaction
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const result = await db
      .insert(customerWalletTransactions)
      .values(transactionData);
    return (result as any).insertId as number;
  } catch (error) {
    console.error("[Database] Failed to create wallet transaction:", error);
    throw error;
  }
}

export async function getWalletTransactions(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  try {
    const transactions = await db
      .select()
      .from(customerWalletTransactions)
      .where(eq(customerWalletTransactions.userId, userId))
      .orderBy(desc(customerWalletTransactions.createdAt))
      .limit(limit);

    return transactions;
  } catch (error) {
    console.error("[Database] Failed to get wallet transactions:", error);
    return [];
  }
}

export async function updateTransactionStatus(
  transactionId: number,
  status: "completed" | "pending" | "failed"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db
      .update(customerWalletTransactions)
      .set({ status })
      .where(eq(customerWalletTransactions.id, transactionId));

    return true;
  } catch (error) {
    console.error("[Database] Failed to update transaction status:", error);
    throw error;
  }
}

/**
 * WALLET OPERATIONS
 */

export async function processRecharge(
  userId: number,
  amount: number,
  referenceId: string,
  description: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Get current wallet
    const wallet = await getCustomerWallet(userId);
    if (!wallet) throw new Error("Wallet not found");

    // Calculate new balances
    const currentTotal = parseFloat(wallet.totalBalance);
    const currentRecharged = parseFloat(wallet.rechargedBalance);
    const newTotal = currentTotal + amount;
    const newRecharged = currentRecharged + amount;

    // Create transaction record
    await createWalletTransaction({
      userId,
      type: "recharge",
      amount: amount.toFixed(2),
      status: "completed",
      description,
      referenceId,
    });

    // Update wallet balance
    await updateWalletBalance(
      userId,
      newTotal.toFixed(2),
      newRecharged.toFixed(2),
      wallet.referralBalance
    );

    return true;
  } catch (error) {
    console.error("[Database] Failed to process recharge:", error);
    throw error;
  }
}

export async function processWithdrawal(
  userId: number,
  amount: number,
  bankDetails: string,
  description: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Get current wallet
    const wallet = await getCustomerWallet(userId);
    if (!wallet) throw new Error("Wallet not found");

    const currentTotal = parseFloat(wallet.totalBalance);

    // Check if sufficient balance
    if (currentTotal < amount) {
      throw new Error("Insufficient balance");
    }

    // Create pending withdrawal transaction
    await createWalletTransaction({
      userId,
      type: "withdrawal",
      amount: (-amount).toFixed(2),
      status: "pending",
      description,
      bankDetails,
    });

    // Note: Balance is deducted only when withdrawal is approved/completed
    // This is handled by admin approval workflow

    return true;
  } catch (error) {
    console.error("[Database] Failed to process withdrawal:", error);
    throw error;
  }
}

export async function addReferralBonus(
  userId: number,
  amount: number,
  referrerName: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Get current wallet
    const wallet = await getCustomerWallet(userId);
    if (!wallet) throw new Error("Wallet not found");

    // Calculate new balances
    const currentTotal = parseFloat(wallet.totalBalance);
    const currentReferral = parseFloat(wallet.referralBalance);
    const newTotal = currentTotal + amount;
    const newReferral = currentReferral + amount;

    // Create transaction record
    await createWalletTransaction({
      userId,
      type: "referral",
      amount: amount.toFixed(2),
      status: "completed",
      description: `Referral bonus from ${referrerName}`,
    });

    // Update wallet balance
    await updateWalletBalance(
      userId,
      newTotal.toFixed(2),
      wallet.rechargedBalance,
      newReferral.toFixed(2)
    );

    return true;
  } catch (error) {
    console.error("[Database] Failed to add referral bonus:", error);
    throw error;
  }
}

export async function deductPayment(
  userId: number,
  amount: number,
  description: string,
  referenceId?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Get current wallet
    const wallet = await getCustomerWallet(userId);
    if (!wallet) throw new Error("Wallet not found");

    const currentTotal = parseFloat(wallet.totalBalance);

    // Check if sufficient balance
    if (currentTotal < amount) {
      throw new Error("Insufficient balance");
    }

    // Calculate new balance
    const newTotal = currentTotal - amount;

    // Deduct from recharged balance first, then referral balance
    let currentRecharged = parseFloat(wallet.rechargedBalance);
    let currentReferral = parseFloat(wallet.referralBalance);
    let newRecharged = currentRecharged;
    let newReferral = currentReferral;

    if (currentRecharged >= amount) {
      newRecharged = currentRecharged - amount;
    } else {
      newRecharged = 0;
      newReferral = currentReferral - (amount - currentRecharged);
    }

    // Create transaction record
    await createWalletTransaction({
      userId,
      type: "payment",
      amount: (-amount).toFixed(2),
      status: "completed",
      description,
      referenceId,
    });

    // Update wallet balance
    await updateWalletBalance(
      userId,
      newTotal.toFixed(2),
      newRecharged.toFixed(2),
      newReferral.toFixed(2)
    );

    return true;
  } catch (error) {
    console.error("[Database] Failed to deduct payment:", error);
    throw error;
  }
}
