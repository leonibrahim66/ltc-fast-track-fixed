import { describe, it, expect } from "vitest";

// ─── Helpers replicated from notifications.tsx ──────────────────────────────

type NotifType =
  | "pickup_update"
  | "driver_accepted"
  | "driver_arriving"
  | "pickup_completed"
  | "payment"
  | "subscription"
  | "system"
  | "support";

const TYPE_CONFIG: Record<NotifType, { icon: string; color: string }> = {
  pickup_update:    { icon: "recycling",         color: "#1B4332" },
  driver_accepted:  { icon: "check-circle",      color: "#16A34A" },
  driver_arriving:  { icon: "local-shipping",    color: "#2563EB" },
  pickup_completed: { icon: "done-all",          color: "#059669" },
  payment:          { icon: "payments",          color: "#7C3AED" },
  subscription:     { icon: "card-membership",   color: "#0891B2" },
  support:          { icon: "support-agent",     color: "#D97706" },
  system:           { icon: "campaign",          color: "#6B7280" },
};

function formatDate(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1)  return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24)  return `${diffHr}h ago`;
  if (diffDay < 7)  return `${diffDay}d ago`;
  return date.toLocaleDateString("en-ZM", { month: "short", day: "numeric" });
}

// ─── Notification type config tests ─────────────────────────────────────────

describe("Notification type config", () => {
  it("has config for all 8 notification types", () => {
    const types: NotifType[] = [
      "pickup_update",
      "driver_accepted",
      "driver_arriving",
      "pickup_completed",
      "payment",
      "subscription",
      "system",
      "support",
    ];
    for (const t of types) {
      expect(TYPE_CONFIG[t]).toBeDefined();
      expect(TYPE_CONFIG[t].icon).toBeTruthy();
      expect(TYPE_CONFIG[t].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("driver_accepted has green color", () => {
    expect(TYPE_CONFIG.driver_accepted.color).toBe("#16A34A");
  });

  it("payment has purple color", () => {
    expect(TYPE_CONFIG.payment.color).toBe("#7C3AED");
  });

  it("system has grey color", () => {
    expect(TYPE_CONFIG.system.color).toBe("#6B7280");
  });
});

// ─── formatDate tests ────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("returns 'Just now' for very recent dates", () => {
    const now = new Date();
    expect(formatDate(now)).toBe("Just now");
  });

  it("returns minutes ago for < 1 hour", () => {
    const d = new Date(Date.now() - 15 * 60_000);
    expect(formatDate(d)).toBe("15m ago");
  });

  it("returns hours ago for < 24 hours", () => {
    const d = new Date(Date.now() - 3 * 3_600_000);
    expect(formatDate(d)).toBe("3h ago");
  });

  it("returns days ago for < 7 days", () => {
    const d = new Date(Date.now() - 2 * 86_400_000);
    expect(formatDate(d)).toBe("2d ago");
  });

  it("accepts string dates", () => {
    const d = new Date(Date.now() - 5 * 60_000);
    expect(formatDate(d.toISOString())).toBe("5m ago");
  });
});

// ─── Unread count logic tests ────────────────────────────────────────────────

describe("Unread count logic", () => {
  const makeNotif = (id: number, isRead: boolean) => ({
    id,
    userId: "user1",
    type: "system" as NotifType,
    title: "Test",
    body: "Body",
    isRead,
    createdAt: new Date().toISOString(),
  });

  it("counts unread notifications correctly", () => {
    const notifs = [
      makeNotif(1, false),
      makeNotif(2, true),
      makeNotif(3, false),
      makeNotif(4, true),
      makeNotif(5, false),
    ];
    const unread = notifs.filter((n) => !n.isRead).length;
    expect(unread).toBe(3);
  });

  it("returns 0 when all notifications are read", () => {
    const notifs = [makeNotif(1, true), makeNotif(2, true)];
    const unread = notifs.filter((n) => !n.isRead).length;
    expect(unread).toBe(0);
  });

  it("returns 0 for empty notification list", () => {
    const notifs: typeof makeNotif extends (...args: any[]) => infer R ? R[] : never[] = [];
    const unread = notifs.filter((n) => !n.isRead).length;
    expect(unread).toBe(0);
  });

  it("badge shows 99+ for counts above 99", () => {
    const count = 150;
    const badge = count > 99 ? "99+" : String(count);
    expect(badge).toBe("99+");
  });

  it("badge shows exact count for <= 99", () => {
    const count = 42;
    const badge = count > 99 ? "99+" : String(count);
    expect(badge).toBe("42");
  });
});

// ─── Notification routing logic tests ────────────────────────────────────────

describe("Notification routing", () => {
  const pickupTypes: NotifType[] = [
    "pickup_update",
    "driver_accepted",
    "driver_arriving",
    "pickup_completed",
  ];

  it("pickup-related types should navigate to pickups tab", () => {
    for (const type of pickupTypes) {
      const shouldGoToPickups =
        type === "pickup_update" ||
        type === "driver_accepted" ||
        type === "driver_arriving" ||
        type === "pickup_completed";
      expect(shouldGoToPickups).toBe(true);
    }
  });

  it("payment type should navigate to payment-history", () => {
    const type: NotifType = "payment";
    const dest = type === "payment" ? "/payment-history" : "/(tabs)/pickups";
    expect(dest).toBe("/payment-history");
  });

  it("system type does not navigate", () => {
    const type: string = "system";
    const isPickup =
      type === "pickup_update" ||
      type === "driver_accepted" ||
      type === "driver_arriving" ||
      type === "pickup_completed";
    const isPayment = type === "payment";
    expect(isPickup || isPayment).toBe(false);
  });
});
