/**
 * lib/firebase-in-app-messaging.ts
 *
 * Firebase In-App Messaging triggers for LTC Fast Track.
 *
 * Contextual messages triggered by app events:
 *  1. welcome_message           — After user registration (first login)
 *  2. pickup_reminder           — Before scheduled garbage collection
 *  3. inactive_user_reminder    — User hasn't opened app in 7+ days
 *  4. new_services_announcement — New service or feature available
 *
 * Firebase In-App Messaging displays messages configured in the Firebase Console
 * when the corresponding trigger event is fired. Messages are shown automatically
 * by the Firebase SDK when the trigger matches a campaign condition.
 *
 * Event IDs must match the trigger event names configured in Firebase Console
 * under Engage → In-App Messaging → Create Campaign → Trigger.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { inAppMessaging } from "./firebase";

// ─── Trigger event IDs ────────────────────────────────────────────────────────
// These MUST match the trigger event names configured in Firebase Console.

export const IN_APP_MESSAGE_EVENTS = {
  WELCOME_MESSAGE: "welcome_message",
  PICKUP_REMINDER: "pickup_reminder",
  INACTIVE_USER_REMINDER: "inactive_user_reminder",
  NEW_SERVICES_ANNOUNCEMENT: "new_services_announcement",
} as const;

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  WELCOME_SHOWN: "@ltc_iam_welcome_shown",
  LAST_ACTIVE: "@ltc_iam_last_active",
  INACTIVE_REMINDER_SHOWN: "@ltc_iam_inactive_shown_at",
};

// ─── 1. Welcome Message ───────────────────────────────────────────────────────

/**
 * Trigger the welcome message after a new user registers.
 * Only fires once per device (guarded by AsyncStorage flag).
 */
export async function triggerWelcomeMessage(): Promise<void> {
  try {
    const alreadyShown = await AsyncStorage.getItem(KEYS.WELCOME_SHOWN);
    if (alreadyShown === "true") return;

    await inAppMessaging.triggerEvent(IN_APP_MESSAGE_EVENTS.WELCOME_MESSAGE);
    await AsyncStorage.setItem(KEYS.WELCOME_SHOWN, "true");

    if (__DEV__) {
      console.log("[InAppMessaging] Welcome message triggered.");
    }
  } catch (error) {
    if (__DEV__) console.warn("[InAppMessaging] triggerWelcomeMessage error:", error);
  }
}

// ─── 2. Pickup Reminder ───────────────────────────────────────────────────────

/**
 * Trigger a pickup reminder when a pickup is scheduled within the next 24 hours.
 * @param scheduledDate ISO date string of the upcoming pickup
 */
export async function triggerPickupReminder(scheduledDate: string): Promise<void> {
  try {
    const scheduled = new Date(scheduledDate);
    const now = new Date();
    const hoursUntilPickup = (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Only trigger if pickup is within 24 hours
    if (hoursUntilPickup > 0 && hoursUntilPickup <= 24) {
      await inAppMessaging.triggerEvent(IN_APP_MESSAGE_EVENTS.PICKUP_REMINDER);

      if (__DEV__) {
        console.log(`[InAppMessaging] Pickup reminder triggered (${hoursUntilPickup.toFixed(1)}h away).`);
      }
    }
  } catch (error) {
    if (__DEV__) console.warn("[InAppMessaging] triggerPickupReminder error:", error);
  }
}

// ─── 3. Inactive User Reminder ────────────────────────────────────────────────

/**
 * Track last active timestamp. Call on every app open.
 */
export async function trackUserActivity(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.LAST_ACTIVE, new Date().toISOString());
  } catch {}
}

/**
 * Check if the user has been inactive for 7+ days and trigger the reminder.
 * Call on app open after authentication.
 */
export async function checkAndTriggerInactiveReminder(): Promise<void> {
  try {
    const lastActiveStr = await AsyncStorage.getItem(KEYS.LAST_ACTIVE);
    if (!lastActiveStr) {
      // First time — just record activity
      await trackUserActivity();
      return;
    }

    const lastActive = new Date(lastActiveStr);
    const now = new Date();
    const daysSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceActive >= 7) {
      // Check if we already showed the reminder recently (within last 3 days)
      const lastReminderStr = await AsyncStorage.getItem(KEYS.INACTIVE_REMINDER_SHOWN);
      if (lastReminderStr) {
        const lastReminder = new Date(lastReminderStr);
        const daysSinceReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceReminder < 3) return; // Don't spam
      }

      await inAppMessaging.triggerEvent(IN_APP_MESSAGE_EVENTS.INACTIVE_USER_REMINDER);
      await AsyncStorage.setItem(KEYS.INACTIVE_REMINDER_SHOWN, now.toISOString());

      if (__DEV__) {
        console.log(`[InAppMessaging] Inactive user reminder triggered (${daysSinceActive.toFixed(0)} days inactive).`);
      }
    }

    // Update last active
    await trackUserActivity();
  } catch (error) {
    if (__DEV__) console.warn("[InAppMessaging] checkAndTriggerInactiveReminder error:", error);
  }
}

// ─── 4. New Services Announcement ────────────────────────────────────────────

/**
 * Trigger a new services announcement.
 * Call when a new feature or service is launched.
 * @param featureKey Unique key for the feature (prevents re-showing)
 */
export async function triggerNewServicesAnnouncement(featureKey: string): Promise<void> {
  try {
    const storageKey = `@ltc_iam_announcement_${featureKey}`;
    const alreadyShown = await AsyncStorage.getItem(storageKey);
    if (alreadyShown === "true") return;

    await inAppMessaging.triggerEvent(IN_APP_MESSAGE_EVENTS.NEW_SERVICES_ANNOUNCEMENT);
    await AsyncStorage.setItem(storageKey, "true");

    if (__DEV__) {
      console.log(`[InAppMessaging] New services announcement triggered for: ${featureKey}`);
    }
  } catch (error) {
    if (__DEV__) console.warn("[InAppMessaging] triggerNewServicesAnnouncement error:", error);
  }
}

// ─── Suppress/Restore messages ────────────────────────────────────────────────

/**
 * Suppress all in-app messages (e.g., during onboarding or payment flows).
 */
export async function suppressInAppMessages(): Promise<void> {
  await inAppMessaging.setMessagesDisplaySuppressed(true);
}

/**
 * Restore in-app message display.
 */
export async function restoreInAppMessages(): Promise<void> {
  await inAppMessaging.setMessagesDisplaySuppressed(false);
}
