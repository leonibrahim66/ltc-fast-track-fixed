import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  customerLinkedAccounts,
  InsertCustomerLinkedAccount,
} from "../drizzle/schema";
import * as crypto from "crypto";

/**
 * Hash PIN using SHA-256
 */
function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

/**
 * Verify PIN against hashed PIN
 */
function verifyPin(pin: string, hashedPin: string): boolean {
  return hashPin(pin) === hashedPin;
}

/**
 * LINKED ACCOUNT QUERIES
 */

export async function getLinkedAccount(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db
      .select()
      .from(customerLinkedAccounts)
      .where(
        and(
          eq(customerLinkedAccounts.userId, userId),
          eq(customerLinkedAccounts.status, "active")
        )
      )
      .limit(1);

    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get linked account:", error);
    return undefined;
  }
}

export async function createLinkedAccount(
  userId: number,
  provider: "mtn_momo" | "airtel_money" | "zamtel_money",
  phoneNumber: string,
  withdrawalPin: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Check if user already has a linked account
    const existing = await getLinkedAccount(userId);
    if (existing) {
      throw new Error("User already has a linked account. Please unlink it first.");
    }

    // Hash the PIN before storing
    const hashedPin = hashPin(withdrawalPin);

    // Insert new linked account
    const result = await db.insert(customerLinkedAccounts).values({
      userId,
      provider,
      phoneNumber,
      withdrawalPin: hashedPin,
      status: "active",
    });

    return (result as any).insertId as number;
  } catch (error) {
    console.error("[Database] Failed to create linked account:", error);
    throw error;
  }
}

export async function updateLinkedAccount(
  userId: number,
  provider: "mtn_momo" | "airtel_money" | "zamtel_money",
  phoneNumber: string,
  withdrawalPin?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const updateData: any = {
      provider,
      phoneNumber,
    };

    // Only update PIN if provided
    if (withdrawalPin) {
      updateData.withdrawalPin = hashPin(withdrawalPin);
    }

    await db
      .update(customerLinkedAccounts)
      .set(updateData)
      .where(
        and(
          eq(customerLinkedAccounts.userId, userId),
          eq(customerLinkedAccounts.status, "active")
        )
      );

    return true;
  } catch (error) {
    console.error("[Database] Failed to update linked account:", error);
    throw error;
  }
}

export async function unlinkAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db
      .update(customerLinkedAccounts)
      .set({ status: "inactive" })
      .where(
        and(
          eq(customerLinkedAccounts.userId, userId),
          eq(customerLinkedAccounts.status, "active")
        )
      );

    return true;
  } catch (error) {
    console.error("[Database] Failed to unlink account:", error);
    throw error;
  }
}

export async function verifyWithdrawalPin(userId: number, pin: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const linkedAccount = await getLinkedAccount(userId);
    if (!linkedAccount) {
      return false;
    }

    return verifyPin(pin, linkedAccount.withdrawalPin);
  } catch (error) {
    console.error("[Database] Failed to verify withdrawal PIN:", error);
    return false;
  }
}

export { hashPin, verifyPin };
