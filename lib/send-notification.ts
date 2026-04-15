/**
 * lib/send-notification.ts
 *
 * Shared utility for sending notifications to any user in the LTC Fast Track app.
 *
 * Architecture:
 * - Writes directly to the Supabase `user_notifications` table
 * - The GlobalNotificationProvider reads from the same table via Realtime subscription
 * - This ensures the bell badge and notifications screen always show real data
 *
 * Usage:
 *   await sendNotification({
 *     userId: 'user_123',
 *     type: 'pickup_update',
 *     title: 'Pickup Assigned',
 *     body: 'A driver has been assigned to your pickup request.',
 *     pickupId: 'pickup_456',
 *   });
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type NotifType =
  | "pickup_update"
  | "driver_accepted"
  | "driver_arriving"
  | "pickup_completed"
  | "payment"
  | "subscription"
  | "system"
  | "support";

// Keep backward-compatible alias
export type NotificationType = NotifType;

export interface SendNotificationPayload {
  /** The recipient user's ID (matches user.id in auth-context) */
  userId: string;
  /** Notification category — maps to the type enum in user_notifications */
  type: NotifType;
  /** Short title shown in the banner and notification list */
  title: string;
  /** Full notification body/message */
  body: string;
  /** Optional reference to a pickup (for deep-linking) */
  pickupId?: string;
  /** Optional extra data payload (stored as JSONB) */
  data?: Record<string, unknown> | string;
}

/**
 * Insert a notification row into Supabase for the given user.
 * The GlobalNotificationProvider will pick it up via Realtime subscription
 * or on the next 15-second poll.
 *
 * This function never throws — errors are logged and swallowed so that
 * action handlers are never blocked by a notification failure.
 */
export async function sendNotification(
  payload: SendNotificationPayload
): Promise<void> {
  const { userId, type, title, body, pickupId, data } = payload;

  if (!userId || userId.trim() === "") {
    console.warn("[sendNotification] Skipped — userId is empty");
    return;
  }

  if (!isSupabaseConfigured()) {
    console.warn(
      "[sendNotification] Supabase not configured — notification not saved.\n" +
        "  Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY."
    );
    return;
  }

  try {
    // Normalise data: Supabase stores it as JSONB
    let dataValue: Record<string, unknown> | null = null;
    if (data) {
      if (typeof data === "string") {
        try {
          dataValue = JSON.parse(data);
        } catch {
          dataValue = { raw: data };
        }
      } else {
        dataValue = data;
      }
    }

    const row: Record<string, unknown> = {
      user_id: userId,
      type,
      title,
      message: body,
      read_status: false,
    };

    if (pickupId) row.pickup_id = pickupId;
    if (dataValue) row.data = dataValue;

    const { error } = await supabase.from("user_notifications").insert(row);

    if (error) {
      console.error("[sendNotification] Supabase insert error:", error.message, {
        userId,
        type,
        title,
      });
    } else {
      console.log("[sendNotification] ✅ Sent:", type, "→", userId, `"${title}"`);
    }
  } catch (err) {
    console.error("[sendNotification] Unexpected error:", err);
  }
}

/**
 * Send notifications to multiple users at once.
 * All sends are fired in parallel; individual failures are silently ignored.
 */
export async function sendNotifications(
  payloads: SendNotificationPayload[]
): Promise<void> {
  await Promise.allSettled(payloads.map(sendNotification));
}

/**
 * Send the same notification to multiple users at once.
 * Fires all inserts in parallel; individual failures are logged but don't
 * block the others.
 */
export async function sendNotificationToMany(
  userIds: string[],
  params: Omit<SendNotificationPayload, "userId">
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  await Promise.all(unique.map((uid) => sendNotification({ ...params, userId: uid })));
}
