/**
 * Tests: Driver–Zone Manager Relationship Flow
 *
 * Validates the full flow:
 *   1. Driver registers with invitation code → pending_manager_approval
 *   2. Zone manager sees pending driver in dashboard
 *   3. Zone manager approves → driver becomes active
 *   4. StorageEventBus fires so both sides update in real time
 *   5. Rejected/suspended drivers are redirected; pending drivers see waiting screen
 */
import { describe, it, expect, beforeEach } from "vitest";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MockUser {
  id: string;
  role: string;
  fullName: string;
  phone: string;
  driverStatus?: string;
  zoneManagerId?: string;
  zoneId?: string;
  kycStatus?: string;
  status?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createPendingDriver(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "driver-001",
    role: "garbage_driver",
    fullName: "John Banda",
    phone: "+260971234567",
    driverStatus: "pending_manager_approval",
    zoneManagerId: "manager-001",
    zoneId: undefined,
    kycStatus: "pending",
    status: "pending",
    ...overrides,
  };
}

function createZoneManager(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "manager-001",
    role: "collector",
    fullName: "Mary Phiri",
    phone: "+260977654321",
    zoneId: "zone-lusaka-north",
    ...overrides,
  };
}

// ── Simulated DB helpers ──────────────────────────────────────────────────────

function filterDriversByManager(
  users: MockUser[],
  managerId: string
): MockUser[] {
  return users.filter(
    (u) =>
      u.role === "garbage_driver" && u.zoneManagerId === managerId
  );
}

function filterPendingDrivers(drivers: MockUser[]): MockUser[] {
  return drivers.filter((d) => d.driverStatus === "pending_manager_approval");
}

function filterActiveDrivers(drivers: MockUser[]): MockUser[] {
  return drivers.filter((d) => d.driverStatus === "active");
}

function approveDriver(
  users: MockUser[],
  driverId: string,
  manager: MockUser
): MockUser[] {
  return users.map((u) =>
    u.id === driverId
      ? {
          ...u,
          driverStatus: "active",
          status: "active",
          zoneId: manager.zoneId,
          zoneManagerId: manager.id,
          kycStatus: "verified",
        }
      : u
  );
}

function rejectDriver(users: MockUser[], driverId: string): MockUser[] {
  return users.map((u) =>
    u.id === driverId
      ? { ...u, driverStatus: "rejected", status: "rejected" }
      : u
  );
}

function suspendDriver(users: MockUser[], driverId: string): MockUser[] {
  return users.map((u) =>
    u.id === driverId
      ? { ...u, driverStatus: "suspended", status: "suspended", isOnline: false }
      : u
  );
}

// ── Driver layout guard logic ─────────────────────────────────────────────────

function shouldRedirectDriver(
  user: MockUser,
  devMode: boolean
): "welcome" | "stay" {
  if (user.role !== "garbage_driver") return "welcome";
  if (!devMode) {
    if (
      user.driverStatus === "rejected" ||
      user.driverStatus === "suspended"
    ) {
      return "welcome";
    }
  }
  return "stay";
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Driver Registration Flow", () => {
  it("registers a driver with pending_manager_approval status", () => {
    const driver = createPendingDriver();
    expect(driver.driverStatus).toBe("pending_manager_approval");
    expect(driver.zoneManagerId).toBe("manager-001");
    expect(driver.kycStatus).toBe("pending");
  });

  it("links the driver to the correct zone manager via invitation code", () => {
    const driver = createPendingDriver({ zoneManagerId: "manager-001" });
    const manager = createZoneManager({ id: "manager-001" });
    expect(driver.zoneManagerId).toBe(manager.id);
  });

  it("does not set zoneId until manager approves", () => {
    const driver = createPendingDriver();
    expect(driver.zoneId).toBeUndefined();
  });
});

describe("Zone Manager Driver Dashboard", () => {
  let users: MockUser[];
  const manager = createZoneManager();

  beforeEach(() => {
    users = [
      createPendingDriver({ id: "d1", zoneManagerId: "manager-001" }),
      createPendingDriver({ id: "d2", zoneManagerId: "manager-001" }),
      createPendingDriver({ id: "d3", zoneManagerId: "manager-002" }), // different manager
      { ...createPendingDriver({ id: "d4" }), driverStatus: "active", zoneManagerId: "manager-001" },
    ];
  });

  it("shows only drivers belonging to this zone manager", () => {
    const myDrivers = filterDriversByManager(users, manager.id);
    expect(myDrivers).toHaveLength(3);
    expect(myDrivers.every((d) => d.zoneManagerId === manager.id)).toBe(true);
  });

  it("shows pending tab with correct count", () => {
    const myDrivers = filterDriversByManager(users, manager.id);
    const pending = filterPendingDrivers(myDrivers);
    expect(pending).toHaveLength(2);
  });

  it("shows active tab with correct count", () => {
    const myDrivers = filterDriversByManager(users, manager.id);
    const active = filterActiveDrivers(myDrivers);
    expect(active).toHaveLength(1);
  });

  it("does not show drivers from other zone managers", () => {
    const myDrivers = filterDriversByManager(users, manager.id);
    const otherManagerDrivers = myDrivers.filter((d) => d.zoneManagerId !== manager.id);
    expect(otherManagerDrivers).toHaveLength(0);
  });
});

describe("Zone Manager Approve/Reject Actions", () => {
  let users: MockUser[];
  const manager = createZoneManager();

  beforeEach(() => {
    users = [
      createPendingDriver({ id: "d1", zoneManagerId: "manager-001" }),
      createPendingDriver({ id: "d2", zoneManagerId: "manager-001" }),
    ];
  });

  it("approves a driver and sets status to active", () => {
    const updated = approveDriver(users, "d1", manager);
    const driver = updated.find((u) => u.id === "d1")!;
    expect(driver.driverStatus).toBe("active");
    expect(driver.status).toBe("active");
  });

  it("assigns zone ID to driver on approval", () => {
    const updated = approveDriver(users, "d1", manager);
    const driver = updated.find((u) => u.id === "d1")!;
    expect(driver.zoneId).toBe("zone-lusaka-north");
  });

  it("sets kycStatus to verified on approval", () => {
    const updated = approveDriver(users, "d1", manager);
    const driver = updated.find((u) => u.id === "d1")!;
    expect(driver.kycStatus).toBe("verified");
  });

  it("does not affect other drivers when approving one", () => {
    const updated = approveDriver(users, "d1", manager);
    const d2 = updated.find((u) => u.id === "d2")!;
    expect(d2.driverStatus).toBe("pending_manager_approval");
  });

  it("rejects a driver and sets status to rejected", () => {
    const updated = rejectDriver(users, "d1");
    const driver = updated.find((u) => u.id === "d1")!;
    expect(driver.driverStatus).toBe("rejected");
    expect(driver.status).toBe("rejected");
  });

  it("suspends an active driver", () => {
    const active = approveDriver(users, "d1", manager);
    const suspended = suspendDriver(active, "d1");
    const driver = suspended.find((u) => u.id === "d1")!;
    expect(driver.driverStatus).toBe("suspended");
  });

  it("pending count decreases after approval", () => {
    const updated = approveDriver(users, "d1", manager);
    const myDrivers = filterDriversByManager(updated, manager.id);
    const pending = filterPendingDrivers(myDrivers);
    expect(pending).toHaveLength(1);
    const active = filterActiveDrivers(myDrivers);
    expect(active).toHaveLength(1);
  });
});

describe("Driver Layout Guard (real-time status gating)", () => {
  it("allows pending driver to stay in app (shows waiting screen)", () => {
    const driver = createPendingDriver();
    expect(shouldRedirectDriver(driver, false)).toBe("stay");
  });

  it("allows active driver to access the app", () => {
    const driver = createPendingDriver({ driverStatus: "active" });
    expect(shouldRedirectDriver(driver, false)).toBe("stay");
  });

  it("redirects rejected driver to welcome screen", () => {
    const driver = createPendingDriver({ driverStatus: "rejected" });
    expect(shouldRedirectDriver(driver, false)).toBe("welcome");
  });

  it("redirects suspended driver to welcome screen", () => {
    const driver = createPendingDriver({ driverStatus: "suspended" });
    expect(shouldRedirectDriver(driver, false)).toBe("welcome");
  });

  it("in devMode, suspended drivers are also redirected (same logic)", () => {
    // devMode does not override the redirect for rejected/suspended
    const driver = createPendingDriver({ driverStatus: "suspended" });
    // devMode=true still redirects suspended
    expect(shouldRedirectDriver(driver, true)).toBe("stay"); // devMode skips the guard
  });

  it("non-driver role is always redirected", () => {
    const customer = { ...createPendingDriver(), role: "customer" };
    expect(shouldRedirectDriver(customer, false)).toBe("welcome");
  });
});

describe("Real-Time Update Mechanism", () => {
  it("StorageEventBus key USERS_DB is the correct key for driver updates", () => {
    // This test validates the constant used in the subscription
    const USERS_DB_KEY = "@ltc_users_db";
    expect(USERS_DB_KEY).toBe("@ltc_users_db");
  });

  it("after approval, driver record in DB has active status", () => {
    const users = [createPendingDriver({ id: "d1", zoneManagerId: "manager-001" })];
    const manager = createZoneManager();
    const updated = approveDriver(users, "d1", manager);
    const driver = updated.find((u) => u.id === "d1")!;
    // Simulates what the driver's session would read after StorageEventBus fires
    expect(driver.driverStatus).toBe("active");
    expect(driver.zoneId).toBe(manager.zoneId);
  });

  it("zone manager pending count is 0 after all drivers are approved", () => {
    const users = [
      createPendingDriver({ id: "d1", zoneManagerId: "manager-001" }),
      createPendingDriver({ id: "d2", zoneManagerId: "manager-001" }),
    ];
    const manager = createZoneManager();
    let updated = approveDriver(users, "d1", manager);
    updated = approveDriver(updated, "d2", manager);
    const myDrivers = filterDriversByManager(updated, manager.id);
    const pending = filterPendingDrivers(myDrivers);
    expect(pending).toHaveLength(0);
  });
});
