/**
 * Zone Manager Dashboard — Unit Tests
 * Tests for the redesigned dashboard: stats, revenue, map data, quick actions, and notification bell.
 */
import { describe, it, expect } from "vitest";

// ─── Helpers (copied from the dashboard component) ────────────────────────────

function formatKwacha(amount: number): string {
  return `K${amount.toLocaleString("en-ZM", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  return { start, end };
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { start, end };
}

// ─── Revenue Calculation Logic ────────────────────────────────────────────────

function sumRevenue(payments: { amount: string }[]): number {
  return payments.reduce((sum, p) => sum + parseFloat(p.amount ?? "0"), 0);
}

function applyCommission(gross: number, rate: number) {
  const commission = gross * (rate / 100);
  const net = gross - commission;
  return { gross, commission, net };
}

// ─── Notification Bell Logic ──────────────────────────────────────────────────

function getUnreadCount(notifications: { isRead: boolean }[]): number {
  return notifications.filter((n) => !n.isRead).length;
}

function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

// ─── Zone Pickup Filtering ────────────────────────────────────────────────────

interface Pickup {
  id: string;
  zoneId?: string;
  status: string;
  location?: { latitude: number; longitude: number };
}

function filterZonePickups(pickups: Pickup[], zoneId: string): Pickup[] {
  return pickups.filter((p) => p.zoneId === zoneId);
}

function getPendingPickups(pickups: Pickup[]): Pickup[] {
  return pickups.filter((p) => p.status === "pending");
}

function getActivePickups(pickups: Pickup[]): Pickup[] {
  return pickups.filter((p) => p.status !== "pending" && p.location?.latitude);
}

// ─── Driver Status Filtering ──────────────────────────────────────────────────

interface DriverStatus {
  driverId: string;
  driverName: string;
  zoneId: string;
  latitude: number;
  longitude: number;
  isOnline: boolean;
  activePickupId?: string;
}

function getOnlineZoneDrivers(drivers: DriverStatus[], zoneId: string): DriverStatus[] {
  return drivers.filter((d) => d.zoneId === zoneId && d.isOnline);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Zone Manager Dashboard — Revenue Helpers", () => {
  it("formats Kwacha amounts correctly", () => {
    expect(formatKwacha(1500)).toBe("K1,500.00");
    expect(formatKwacha(0)).toBe("K0.00");
    expect(formatKwacha(99.5)).toBe("K99.50");
    expect(formatKwacha(1234567.89)).toBe("K1,234,567.89");
  });

  it("sums revenue from payment records", () => {
    const payments = [
      { amount: "150.00" },
      { amount: "200.50" },
      { amount: "99.99" },
    ];
    expect(sumRevenue(payments)).toBeCloseTo(450.49, 2);
  });

  it("sums zero revenue for empty payments", () => {
    expect(sumRevenue([])).toBe(0);
  });

  it("applies commission correctly at 10%", () => {
    const result = applyCommission(1000, 10);
    expect(result.gross).toBe(1000);
    expect(result.commission).toBe(100);
    expect(result.net).toBe(900);
  });

  it("applies commission correctly at 15%", () => {
    const result = applyCommission(2000, 15);
    expect(result.commission).toBe(300);
    expect(result.net).toBe(1700);
  });

  it("applies zero commission at 0%", () => {
    const result = applyCommission(500, 0);
    expect(result.commission).toBe(0);
    expect(result.net).toBe(500);
  });
});

describe("Zone Manager Dashboard — Date Range Helpers", () => {
  it("today range starts and ends on the same date", () => {
    const { start, end } = getTodayRange();
    const startDate = new Date(start).toDateString();
    const endDate = new Date(end).toDateString();
    expect(startDate).toBe(endDate);
  });

  it("week range spans 7 days", () => {
    const { start, end } = getWeekRange();
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    // Sunday 00:00:00 to Saturday 23:59:59 = ~6.9999 days
    expect(days).toBeGreaterThanOrEqual(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("month range starts on day 1", () => {
    const { start } = getMonthRange();
    expect(new Date(start).getDate()).toBe(1);
  });

  it("month range ends on last day of month", () => {
    const { end } = getMonthRange();
    const endDate = new Date(end);
    const nextDay = new Date(endDate);
    nextDay.setDate(endDate.getDate() + 1);
    expect(nextDay.getDate()).toBe(1); // next day is 1st of next month
  });
});

describe("Zone Manager Dashboard — Notification Bell", () => {
  it("counts unread notifications correctly", () => {
    const notifications = [
      { isRead: false },
      { isRead: true },
      { isRead: false },
      { isRead: false },
    ];
    expect(getUnreadCount(notifications)).toBe(3);
  });

  it("returns 0 when all notifications are read", () => {
    const notifications = [{ isRead: true }, { isRead: true }];
    expect(getUnreadCount(notifications)).toBe(0);
  });

  it("returns 0 for empty notifications", () => {
    expect(getUnreadCount([])).toBe(0);
  });

  it("formats badge count correctly", () => {
    expect(formatBadgeCount(5)).toBe("5");
    expect(formatBadgeCount(99)).toBe("99");
    expect(formatBadgeCount(100)).toBe("99+");
    expect(formatBadgeCount(999)).toBe("99+");
  });
});

describe("Zone Manager Dashboard — Zone Pickup Filtering", () => {
  const allPickups: Pickup[] = [
    { id: "1", zoneId: "zone-1", status: "pending", location: { latitude: -15.4, longitude: 28.3 } },
    { id: "2", zoneId: "zone-1", status: "accepted", location: { latitude: -15.41, longitude: 28.31 } },
    { id: "3", zoneId: "zone-2", status: "pending", location: { latitude: -15.42, longitude: 28.32 } },
    { id: "4", zoneId: "zone-1", status: "completed", location: { latitude: -15.43, longitude: 28.33 } },
    { id: "5", zoneId: "zone-1", status: "pending" }, // no location
  ];

  it("filters pickups to the correct zone", () => {
    const zone1Pickups = filterZonePickups(allPickups, "zone-1");
    expect(zone1Pickups).toHaveLength(4);
    expect(zone1Pickups.every((p) => p.zoneId === "zone-1")).toBe(true);
  });

  it("returns empty array for unknown zone", () => {
    expect(filterZonePickups(allPickups, "zone-99")).toHaveLength(0);
  });

  it("gets only pending pickups", () => {
    const zone1 = filterZonePickups(allPickups, "zone-1");
    const pending = getPendingPickups(zone1);
    expect(pending).toHaveLength(2); // id 1 and 5
  });

  it("gets only active pickups with location", () => {
    const zone1 = filterZonePickups(allPickups, "zone-1");
    const active = getActivePickups(zone1);
    expect(active).toHaveLength(2); // id 2 (accepted) and 4 (completed) have locations
  });
});

describe("Zone Manager Dashboard — Driver Status Filtering", () => {
  const drivers: DriverStatus[] = [
    { driverId: "d1", driverName: "John", zoneId: "zone-1", latitude: -15.4, longitude: 28.3, isOnline: true },
    { driverId: "d2", driverName: "Mary", zoneId: "zone-1", latitude: -15.41, longitude: 28.31, isOnline: false },
    { driverId: "d3", driverName: "Peter", zoneId: "zone-2", latitude: -15.42, longitude: 28.32, isOnline: true },
    { driverId: "d4", driverName: "Susan", zoneId: "zone-1", latitude: -15.43, longitude: 28.33, isOnline: true, activePickupId: "p1" },
  ];

  it("returns only online drivers in the zone", () => {
    const online = getOnlineZoneDrivers(drivers, "zone-1");
    expect(online).toHaveLength(2); // d1 and d4
    expect(online.every((d) => d.isOnline && d.zoneId === "zone-1")).toBe(true);
  });

  it("returns empty for zone with no online drivers", () => {
    expect(getOnlineZoneDrivers(drivers, "zone-3")).toHaveLength(0);
  });

  it("identifies drivers on active pickups", () => {
    const online = getOnlineZoneDrivers(drivers, "zone-1");
    const onPickup = online.filter((d) => d.activePickupId);
    expect(onPickup).toHaveLength(1);
    expect(onPickup[0].driverId).toBe("d4");
  });
});

describe("Zone Manager Dashboard — Quick Actions", () => {
  it("pending pickup count drives the Assign Driver subtitle", () => {
    const pickups: Pickup[] = [
      { id: "1", zoneId: "zone-1", status: "pending" },
      { id: "2", zoneId: "zone-1", status: "pending" },
      { id: "3", zoneId: "zone-1", status: "accepted" },
    ];
    const zone1 = filterZonePickups(pickups, "zone-1");
    const pendingCount = getPendingPickups(zone1).length;
    expect(pendingCount).toBe(2);
    // Subtitle would be "2 pending"
    expect(`${pendingCount} pending`).toBe("2 pending");
  });

  it("driver count drives the Driver Status subtitle", () => {
    const drivers: DriverStatus[] = [
      { driverId: "d1", driverName: "John", zoneId: "zone-1", latitude: 0, longitude: 0, isOnline: true },
      { driverId: "d2", driverName: "Mary", zoneId: "zone-1", latitude: 0, longitude: 0, isOnline: true },
    ];
    const online = getOnlineZoneDrivers(drivers, "zone-1");
    expect(`${online.length} active drivers`).toBe("2 active drivers");
  });
});
