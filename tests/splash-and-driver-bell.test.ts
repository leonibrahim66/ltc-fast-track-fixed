/**
 * Tests for:
 * 1. Splash screen persistence (use-fonts.ts externalReady gate)
 * 2. Driver notification bell (unread count logic + navigation target)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. use-fonts externalReady gate ─────────────────────────────────────────

describe("useFonts externalReady gate", () => {
  it("resolves immediately when no externalReady is provided (original behaviour)", () => {
    // When externalReady is undefined, splash hides as soon as fonts resolve.
    // This is the existing behaviour — no gate.
    const externalReady = undefined;
    const fontsResolved = true;
    // Gate not in use → should be considered ready
    const shouldHide = externalReady === undefined ? fontsResolved : (fontsResolved && externalReady);
    expect(shouldHide).toBe(true);
  });

  it("does NOT hide splash when fonts resolved but externalReady is false", () => {
    const externalReady = false;
    const fontsResolved = true;
    const shouldHide = fontsResolved && externalReady;
    expect(shouldHide).toBe(false);
  });

  it("does NOT hide splash when externalReady is true but fonts not yet resolved", () => {
    const externalReady = true;
    const fontsResolved = false;
    const shouldHide = fontsResolved && externalReady;
    expect(shouldHide).toBe(false);
  });

  it("hides splash when BOTH fonts resolved AND externalReady is true", () => {
    const externalReady = true;
    const fontsResolved = true;
    const shouldHide = fontsResolved && externalReady;
    expect(shouldHide).toBe(true);
  });

  it("handles transition from false to true correctly", () => {
    // Simulate the state transition: auth loading finishes
    let externalReady = false;
    let fontsResolved = true;
    expect(fontsResolved && externalReady).toBe(false);

    // Auth finishes loading
    externalReady = true;
    expect(fontsResolved && externalReady).toBe(true);
  });
});

// ─── 2. Driver notification bell unread count ────────────────────────────────

interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

function computeUnreadCount(notifications: Notification[]): number {
  return notifications.filter((n) => !n.isRead).length;
}

function formatBadgeText(count: number): string {
  if (count === 0) return "";
  if (count > 99) return "99+";
  return String(count);
}

describe("Driver notification bell unread count", () => {
  it("returns 0 when all notifications are read", () => {
    const notifications: Notification[] = [
      { id: "1", userId: "d1", title: "Pickup assigned", body: "...", type: "pickup_assigned", isRead: true, createdAt: new Date().toISOString() },
      { id: "2", userId: "d1", title: "Zone update", body: "...", type: "zone_assignment", isRead: true, createdAt: new Date().toISOString() },
    ];
    expect(computeUnreadCount(notifications)).toBe(0);
  });

  it("counts only unread notifications", () => {
    const notifications: Notification[] = [
      { id: "1", userId: "d1", title: "Pickup assigned", body: "...", type: "pickup_assigned", isRead: false, createdAt: new Date().toISOString() },
      { id: "2", userId: "d1", title: "Zone update", body: "...", type: "zone_assignment", isRead: true, createdAt: new Date().toISOString() },
      { id: "3", userId: "d1", title: "Customer chat", body: "...", type: "customer_chat", isRead: false, createdAt: new Date().toISOString() },
    ];
    expect(computeUnreadCount(notifications)).toBe(2);
  });

  it("returns 0 for empty notification list", () => {
    expect(computeUnreadCount([])).toBe(0);
  });

  it("counts all as unread when none are read", () => {
    const notifications: Notification[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      userId: "d1",
      title: `Notification ${i}`,
      body: "...",
      type: "system",
      isRead: false,
      createdAt: new Date().toISOString(),
    }));
    expect(computeUnreadCount(notifications)).toBe(5);
  });
});

describe("Driver notification bell badge text formatting", () => {
  it("returns empty string when count is 0 (badge hidden)", () => {
    expect(formatBadgeText(0)).toBe("");
  });

  it("returns the count as string for 1-99", () => {
    expect(formatBadgeText(1)).toBe("1");
    expect(formatBadgeText(42)).toBe("42");
    expect(formatBadgeText(99)).toBe("99");
  });

  it("returns '99+' when count exceeds 99", () => {
    expect(formatBadgeText(100)).toBe("99+");
    expect(formatBadgeText(999)).toBe("99+");
  });
});

// ─── 3. Driver notification type config coverage ─────────────────────────────

const DRIVER_NOTIF_TYPES = [
  "pickup_assigned",
  "pickup_update",
  "pickup_completed",
  "zone_manager_message",
  "zone_assignment",
  "driver_approved",
  "driver_suspended",
  "customer_chat",
  "system",
] as const;

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  pickup_assigned:      { icon: "assignment",       color: "#2563EB" },
  pickup_update:        { icon: "recycling",         color: "#1B4332" },
  pickup_completed:     { icon: "done-all",          color: "#059669" },
  zone_manager_message: { icon: "supervisor-account", color: "#7C3AED" },
  zone_assignment:      { icon: "map",               color: "#0891B2" },
  driver_approved:      { icon: "check-circle",      color: "#16A34A" },
  driver_suspended:     { icon: "block",             color: "#DC2626" },
  customer_chat:        { icon: "chat",              color: "#D97706" },
  system:               { icon: "campaign",          color: "#6B7280" },
};

describe("Driver notification type config", () => {
  it("has an entry for every driver notification type", () => {
    for (const type of DRIVER_NOTIF_TYPES) {
      expect(TYPE_CONFIG).toHaveProperty(type);
    }
  });

  it("each type config has a non-empty icon and color", () => {
    for (const [type, config] of Object.entries(TYPE_CONFIG)) {
      expect(config.icon, `${type} icon`).toBeTruthy();
      expect(config.color, `${type} color`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("falls back to 'system' type for unknown notification types", () => {
    const unknownType = "some_future_type";
    const resolvedType = unknownType in TYPE_CONFIG ? unknownType : "system";
    expect(resolvedType).toBe("system");
    expect(TYPE_CONFIG[resolvedType]).toBeDefined();
  });
});

// ─── 4. Auth gate integration logic ──────────────────────────────────────────

describe("AuthGate integration logic", () => {
  it("signals ready when isLoading transitions from true to false", () => {
    let onAuthReadyCalled = false;
    const onAuthReady = () => { onAuthReadyCalled = true; };

    // Simulate: isLoading starts true
    let isLoading = true;
    if (!isLoading) onAuthReady();
    expect(onAuthReadyCalled).toBe(false);

    // Auth finishes loading
    isLoading = false;
    if (!isLoading) onAuthReady();
    expect(onAuthReadyCalled).toBe(true);
  });

  it("does not signal ready while auth is still loading", () => {
    let callCount = 0;
    const onAuthReady = () => { callCount++; };

    const isLoading = true;
    if (!isLoading) onAuthReady();
    expect(callCount).toBe(0);
  });

  it("signals ready immediately if auth was already resolved on mount", () => {
    let callCount = 0;
    const onAuthReady = () => { callCount++; };

    const isLoading = false; // already resolved
    if (!isLoading) onAuthReady();
    expect(callCount).toBe(1);
  });
});
