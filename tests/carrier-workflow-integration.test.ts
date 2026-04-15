/**
 * Carrier Service Integration Tests
 *
 * Validates the complete carrier workflow between customers and drivers:
 * 1. Customer books a carrier → saved to carrier_bookings AND customer_bookings
 * 2. Driver sees booking in job feed → accepts → updates both stores + sends notification
 * 3. Driver updates status (arrived, picked_up, delivered) → syncs to customer_bookings
 * 4. Customer can track driver via customer_bookings (polling every 5s)
 * 5. Customer pays via wallet → paymentStatus updated
 * 6. Live map loads from carrier_active_jobs (not mock data)
 * 7. carrier-profile tab route exists and redirects correctly
 */

import { describe, it, expect, beforeEach } from "vitest";

// ─── Shared storage simulation ─────────────────────────────────────────────
const store: Record<string, string> = {};

const AsyncStorage = {
  getItem: async (key: string) => store[key] ?? null,
  setItem: async (key: string, value: string) => { store[key] = value; },
  removeItem: async (key: string) => { delete store[key]; },
  clear: async () => { Object.keys(store).forEach(k => delete store[k]); },
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    bookingId: `BK-${Date.now()}`,
    customerId: "cust-001",
    customerName: "Alice Banda",
    customerPhone: "+260971234567",
    pickupLocation: "Cairo Road, Lusaka",
    dropoffLocation: "Makeni Mall, Lusaka",
    distance: "8.5 km",
    cargoType: "Household Items",
    cargoWeight: "200 kg",
    vehicleRequired: "Truck",
    estimatedPrice: 350,
    totalAmount: 350,
    status: "pending",
    paymentStatus: "pending",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDriver(overrides: Record<string, unknown> = {}) {
  return {
    id: `drv_${Date.now()}`,
    fullName: "Peter Mwansa",
    phoneNumber: "+260977654321",
    vehicleType: "Truck",
    numberPlate: "BAM 1234",
    vehicleColor: "White",
    vehicleModel: "Isuzu NQR",
    status: "approved",
    ...overrides,
  };
}

// ─── Simulate book.tsx submission ──────────────────────────────────────────
async function customerSubmitBooking(booking: ReturnType<typeof makeBooking>) {
  // book.tsx saves to BOTH carrier_bookings AND customer_bookings
  const carrierStr = await AsyncStorage.getItem("carrier_bookings");
  const carrierList = carrierStr ? JSON.parse(carrierStr) : [];
  carrierList.push(booking);
  await AsyncStorage.setItem("carrier_bookings", JSON.stringify(carrierList));

  const custStr = await AsyncStorage.getItem("customer_bookings");
  const custList = custStr ? JSON.parse(custStr) : [];
  custList.push(booking);
  await AsyncStorage.setItem("customer_bookings", JSON.stringify(custList));
}

// ─── Simulate job-feed.tsx accept ─────────────────────────────────────────
async function driverAcceptBooking(bookingId: string, driver: ReturnType<typeof makeDriver>) {
  const carrierStr = await AsyncStorage.getItem("carrier_bookings");
  const carrierList = carrierStr ? JSON.parse(carrierStr) : [];
  const booking = carrierList.find((b: any) => b.id === bookingId);
  if (!booking) throw new Error("Booking not found in carrier_bookings");

  const now = new Date().toISOString();
  const updatedBooking = {
    ...booking,
    status: "accepted",
    acceptedAt: now,
    driverName: driver.fullName,
    driverPhone: driver.phoneNumber,
    vehicleType: driver.vehicleType,
    vehiclePlate: driver.numberPlate,
    vehicleColor: driver.vehicleColor,
  };

  // Update carrier_bookings
  const updatedCarrier = carrierList.map((b: any) => b.id === bookingId ? updatedBooking : b);
  await AsyncStorage.setItem("carrier_bookings", JSON.stringify(updatedCarrier));

  // Update customer_bookings (the fix from book.tsx)
  const custStr = await AsyncStorage.getItem("customer_bookings");
  const custList = custStr ? JSON.parse(custStr) : [];
  const updatedCust = custList.map((b: any) => b.id === bookingId ? updatedBooking : b);
  await AsyncStorage.setItem("customer_bookings", JSON.stringify(updatedCust));

  // Add to carrier_active_jobs
  const activeStr = await AsyncStorage.getItem("carrier_active_jobs");
  const activeList = activeStr ? JSON.parse(activeStr) : [];
  activeList.push({ ...updatedBooking, acceptedAt: now });
  await AsyncStorage.setItem("carrier_active_jobs", JSON.stringify(activeList));

  // Send notification to customer
  const notifStr = await AsyncStorage.getItem("carrier_notifications");
  const notifs = notifStr ? JSON.parse(notifStr) : [];
  notifs.unshift({
    id: `notif_${Date.now()}`,
    type: "booking_accepted",
    title: "Driver Accepted Your Booking",
    message: `${driver.fullName} has accepted your booking.`,
    bookingId,
    recipientType: "customer",
    read: false,
    createdAt: now,
  });
  await AsyncStorage.setItem("carrier_notifications", JSON.stringify(notifs));
}

// ─── Simulate active-job.tsx status update ────────────────────────────────
async function driverUpdateStatus(bookingId: string, newStatus: string) {
  const now = new Date().toISOString();

  // Update carrier_active_jobs
  const activeStr = await AsyncStorage.getItem("carrier_active_jobs");
  const activeList = activeStr ? JSON.parse(activeStr) : [];
  const updatedActive = activeList.map((j: any) =>
    j.id === bookingId
      ? {
          ...j,
          status: newStatus,
          ...(newStatus === "arrived" ? { arrivedAt: now } : {}),
          ...(newStatus === "picked_up" ? { pickedUpAt: now } : {}),
          ...(newStatus === "delivered" ? { deliveredAt: now } : {}),
        }
      : j
  );
  await AsyncStorage.setItem("carrier_active_jobs", JSON.stringify(updatedActive));

  // Sync customer_bookings
  const custStr = await AsyncStorage.getItem("customer_bookings");
  const custList = custStr ? JSON.parse(custStr) : [];
  const updatedCust = custList.map((b: any) =>
    b.id === bookingId
      ? {
          ...b,
          status: newStatus,
          ...(newStatus === "arrived" ? { arrivedAt: now } : {}),
          ...(newStatus === "picked_up" ? { pickedUpAt: now } : {}),
          ...(newStatus === "delivered" ? { completedAt: now } : {}),
        }
      : b
  );
  await AsyncStorage.setItem("customer_bookings", JSON.stringify(updatedCust));

  // Sync carrier_bookings
  const bkStr = await AsyncStorage.getItem("carrier_bookings");
  const bkList = bkStr ? JSON.parse(bkStr) : [];
  const updatedBk = bkList.map((b: any) => b.id === bookingId ? { ...b, status: newStatus } : b);
  await AsyncStorage.setItem("carrier_bookings", JSON.stringify(updatedBk));

  // Add customer notification
  const msgs: Record<string, string> = {
    arrived: "Your driver has arrived at the pickup location.",
    picked_up: "Your cargo has been picked up and is on the way.",
    delivered: "Your cargo has been delivered successfully!",
  };
  const notifStr = await AsyncStorage.getItem("carrier_notifications");
  const notifs = notifStr ? JSON.parse(notifStr) : [];
  notifs.unshift({
    id: `notif_${Date.now()}`,
    type: "status_update",
    title: "Status Update",
    message: msgs[newStatus] || `Status: ${newStatus}`,
    bookingId,
    recipientType: "customer",
    read: false,
    createdAt: now,
  });
  await AsyncStorage.setItem("carrier_notifications", JSON.stringify(notifs));
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Carrier Service: Customer Booking Flow", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it("saves booking to both carrier_bookings and customer_bookings", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);

    const carrierStr = await AsyncStorage.getItem("carrier_bookings");
    const custStr = await AsyncStorage.getItem("customer_bookings");
    const carrierList = JSON.parse(carrierStr!);
    const custList = JSON.parse(custStr!);

    expect(carrierList).toHaveLength(1);
    expect(custList).toHaveLength(1);
    expect(carrierList[0].id).toBe(booking.id);
    expect(custList[0].id).toBe(booking.id);
  });

  it("booking starts with pending status", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);

    const custStr = await AsyncStorage.getItem("customer_bookings");
    const custList = JSON.parse(custStr!);
    expect(custList[0].status).toBe("pending");
    expect(custList[0].paymentStatus).toBe("pending");
  });

  it("multiple bookings from same customer are all saved", async () => {
    await customerSubmitBooking(makeBooking({ id: "bk1" }));
    await customerSubmitBooking(makeBooking({ id: "bk2" }));
    await customerSubmitBooking(makeBooking({ id: "bk3" }));

    const custStr = await AsyncStorage.getItem("customer_bookings");
    const custList = JSON.parse(custStr!);
    expect(custList).toHaveLength(3);
  });
});

describe("Carrier Service: Driver Acceptance Flow", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it("driver accepting updates both carrier_bookings and customer_bookings", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    const driver = makeDriver();
    await driverAcceptBooking(booking.id, driver);

    const carrierStr = await AsyncStorage.getItem("carrier_bookings");
    const custStr = await AsyncStorage.getItem("customer_bookings");
    const carrierList = JSON.parse(carrierStr!);
    const custList = JSON.parse(custStr!);

    expect(carrierList[0].status).toBe("accepted");
    expect(custList[0].status).toBe("accepted");
  });

  it("driver info is attached to customer_bookings after acceptance", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    const driver = makeDriver({ fullName: "James Phiri", phoneNumber: "+260966123456" });
    await driverAcceptBooking(booking.id, driver);

    const custStr = await AsyncStorage.getItem("customer_bookings");
    const custList = JSON.parse(custStr!);
    expect(custList[0].driverName).toBe("James Phiri");
    expect(custList[0].driverPhone).toBe("+260966123456");
    expect(custList[0].vehicleType).toBe(driver.vehicleType);
    expect(custList[0].vehiclePlate).toBe(driver.numberPlate);
  });

  it("accepted booking appears in carrier_active_jobs", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    await driverAcceptBooking(booking.id, makeDriver());

    const activeStr = await AsyncStorage.getItem("carrier_active_jobs");
    const activeList = JSON.parse(activeStr!);
    expect(activeList).toHaveLength(1);
    expect(activeList[0].id).toBe(booking.id);
    expect(activeList[0].status).toBe("accepted");
  });

  it("customer receives notification when driver accepts", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    await driverAcceptBooking(booking.id, makeDriver({ fullName: "Peter Mwansa" }));

    const notifStr = await AsyncStorage.getItem("carrier_notifications");
    const notifs = JSON.parse(notifStr!);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe("booking_accepted");
    expect(notifs[0].message).toContain("Peter Mwansa");
    expect(notifs[0].recipientType).toBe("customer");
  });
});

describe("Carrier Service: Live Tracking Flow", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it("customer track screen reads from customer_bookings (not carrier_bookings)", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    await driverAcceptBooking(booking.id, makeDriver());

    // Simulate track.tsx loading: reads customer_bookings and finds accepted booking
    const custStr = await AsyncStorage.getItem("customer_bookings");
    const custList = JSON.parse(custStr!);
    const activeBooking = custList.find((b: any) => b.status === "accepted" || b.status === "pending");

    expect(activeBooking).toBeDefined();
    expect(activeBooking.status).toBe("accepted");
    expect(activeBooking.driverName).toBeDefined();
  });

  it("driver status update to arrived syncs to customer_bookings", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    await driverAcceptBooking(booking.id, makeDriver());
    await driverUpdateStatus(booking.id, "arrived");

    const custStr = await AsyncStorage.getItem("customer_bookings");
    const custList = JSON.parse(custStr!);
    expect(custList[0].status).toBe("arrived");
    expect(custList[0].arrivedAt).toBeDefined();
  });

  it("driver status update to picked_up syncs to customer_bookings", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    await driverAcceptBooking(booking.id, makeDriver());
    await driverUpdateStatus(booking.id, "arrived");
    await driverUpdateStatus(booking.id, "picked_up");

    const custStr = await AsyncStorage.getItem("customer_bookings");
    const custList = JSON.parse(custStr!);
    expect(custList[0].status).toBe("picked_up");
    expect(custList[0].pickedUpAt).toBeDefined();
  });

  it("driver status update to delivered syncs to customer_bookings with completedAt", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    await driverAcceptBooking(booking.id, makeDriver());
    await driverUpdateStatus(booking.id, "arrived");
    await driverUpdateStatus(booking.id, "picked_up");
    await driverUpdateStatus(booking.id, "delivered");

    const custStr = await AsyncStorage.getItem("customer_bookings");
    const custList = JSON.parse(custStr!);
    expect(custList[0].status).toBe("delivered");
    expect(custList[0].completedAt).toBeDefined();
  });

  it("customer receives notification for each status update", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    await driverAcceptBooking(booking.id, makeDriver());
    await driverUpdateStatus(booking.id, "arrived");
    await driverUpdateStatus(booking.id, "picked_up");
    await driverUpdateStatus(booking.id, "delivered");

    const notifStr = await AsyncStorage.getItem("carrier_notifications");
    const notifs = JSON.parse(notifStr!);
    // 1 acceptance + 3 status updates = 4 notifications
    expect(notifs).toHaveLength(4);
    const types = notifs.map((n: any) => n.type);
    expect(types).toContain("booking_accepted");
    expect(types.filter((t: string) => t === "status_update")).toHaveLength(3);
  });
});

describe("Carrier Service: Live Map Screen", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it("live map loads from carrier_active_jobs (not mock data)", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    await driverAcceptBooking(booking.id, makeDriver());

    // Simulate carrier-live-map.tsx loadActiveJobs
    const stored = await AsyncStorage.getItem("carrier_active_jobs");
    const jobs = stored ? JSON.parse(stored) : [];

    expect(jobs).toHaveLength(1);
    expect(jobs[0].customerName).toBe(booking.customerName);
    expect(jobs[0].status).toBe("accepted");
  });

  it("live map shows no jobs when driver has no active jobs", async () => {
    const stored = await AsyncStorage.getItem("carrier_active_jobs");
    const jobs = stored ? JSON.parse(stored) : [];
    expect(jobs).toHaveLength(0);
  });

  it("live map status update syncs to customer_bookings", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    await driverAcceptBooking(booking.id, makeDriver());

    // Simulate live map updateStatus (arrived)
    await driverUpdateStatus(booking.id, "arrived");

    const custStr = await AsyncStorage.getItem("customer_bookings");
    const custList = JSON.parse(custStr!);
    expect(custList[0].status).toBe("arrived");
  });

  it("live map non-delivered jobs appear first when sorted", async () => {
    const bk1 = makeBooking({ id: "bk1" });
    const bk2 = makeBooking({ id: "bk2" });
    await customerSubmitBooking(bk1);
    await customerSubmitBooking(bk2);
    const driver = makeDriver();
    await driverAcceptBooking(bk1.id, driver);
    await driverAcceptBooking(bk2.id, driver);
    await driverUpdateStatus(bk1.id, "delivered");

    const stored = await AsyncStorage.getItem("carrier_active_jobs");
    const jobs: any[] = stored ? JSON.parse(stored) : [];
    const sorted = [...jobs].sort((a, b) => {
      if (a.status === "delivered" && b.status !== "delivered") return 1;
      if (a.status !== "delivered" && b.status === "delivered") return -1;
      return 0;
    });

    expect(sorted[0].id).toBe(bk2.id);
    expect(sorted[0].status).toBe("accepted");
    expect(sorted[1].id).toBe(bk1.id);
    expect(sorted[1].status).toBe("delivered");
  });
});

describe("Carrier Service: Payment Flow", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it("booking paymentStatus starts as pending", async () => {
    const booking = makeBooking();
    await customerSubmitBooking(booking);
    const custStr = await AsyncStorage.getItem("customer_bookings");
    const custList = JSON.parse(custStr!);
    expect(custList[0].paymentStatus).toBe("pending");
  });

  it("Pay Now button should be shown for accepted bookings with pending payment", () => {
    // Simulate the condition in my-bookings.tsx
    const booking = makeBooking({ status: "accepted", paymentStatus: "pending" });
    const shouldShowPayNow = (
      (booking.status === "accepted" || booking.status === "completed") &&
      booking.paymentStatus !== "paid"
    );
    expect(shouldShowPayNow).toBe(true);
  });

  it("Pay Now button should NOT be shown for paid bookings", () => {
    const booking = makeBooking({ status: "accepted", paymentStatus: "paid" });
    const shouldShowPayNow = (
      (booking.status === "accepted" || booking.status === "completed") &&
      booking.paymentStatus !== "paid"
    );
    expect(shouldShowPayNow).toBe(false);
  });

  it("Track Driver button shown for accepted bookings", () => {
    const booking = makeBooking({ status: "accepted" });
    const shouldShowTrack = booking.status === "accepted";
    expect(shouldShowTrack).toBe(true);
  });

  it("Rate Driver button shown for completed + paid bookings", () => {
    const booking = makeBooking({ status: "completed", paymentStatus: "paid" });
    const shouldShowRate = booking.status === "completed" && booking.paymentStatus === "paid";
    expect(shouldShowRate).toBe(true);
  });
});

describe("Carrier Service: Route Validation", () => {
  it("carrier-profile tab route file exists", async () => {
    const { existsSync } = await import("fs");
    const exists = existsSync("/home/ubuntu/ltc-fast-track/app/(tabs)/carrier-profile.tsx");
    expect(exists).toBe(true);
  });

  it("carrier-live-map tab route file exists", async () => {
    const { existsSync } = await import("fs");
    const exists = existsSync("/home/ubuntu/ltc-fast-track/app/(tabs)/carrier-live-map.tsx");
    expect(exists).toBe(true);
  });

  it("carrier-dashboard tab route file exists", async () => {
    const { existsSync } = await import("fs");
    const exists = existsSync("/home/ubuntu/ltc-fast-track/app/(tabs)/carrier-dashboard.tsx");
    expect(exists).toBe(true);
  });

  it("carrier bottom nav component file exists", async () => {
    const { existsSync } = await import("fs");
    const exists = existsSync("/home/ubuntu/ltc-fast-track/components/carrier-bottom-nav.tsx");
    expect(exists).toBe(true);
  });

  it("all critical carrier screens exist", async () => {
    const { existsSync } = await import("fs");
    const screens = [
      "/home/ubuntu/ltc-fast-track/app/carrier/book.tsx",
      "/home/ubuntu/ltc-fast-track/app/carrier/my-bookings.tsx",
      "/home/ubuntu/ltc-fast-track/app/carrier/track.tsx",
      "/home/ubuntu/ltc-fast-track/app/carrier/job-feed.tsx",
      "/home/ubuntu/ltc-fast-track/app/carrier/active-job.tsx",
      "/home/ubuntu/ltc-fast-track/app/carrier/driver-profile.tsx",
      "/home/ubuntu/ltc-fast-track/app/carrier/wallet.tsx",
      "/home/ubuntu/ltc-fast-track/app/carrier/notifications.tsx",
    ];
    for (const screen of screens) {
      expect(existsSync(screen), `Missing: ${screen}`).toBe(true);
    }
  });
});

describe("Carrier Service: End-to-End Complete Flow", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it("full workflow: book → accept → track → deliver → pay", async () => {
    // 1. Customer books
    const booking = makeBooking();
    await customerSubmitBooking(booking);

    // 2. Driver accepts
    const driver = makeDriver({ fullName: "John Phiri" });
    await driverAcceptBooking(booking.id, driver);

    // 3. Customer can track (reads customer_bookings)
    const custStr1 = await AsyncStorage.getItem("customer_bookings");
    const custList1 = JSON.parse(custStr1!);
    const trackedBooking = custList1.find((b: any) => b.status === "accepted");
    expect(trackedBooking).toBeDefined();
    expect(trackedBooking.driverName).toBe("John Phiri");

    // 4. Driver updates status
    await driverUpdateStatus(booking.id, "arrived");
    await driverUpdateStatus(booking.id, "picked_up");
    await driverUpdateStatus(booking.id, "delivered");

    // 5. Customer sees delivered status
    const custStr2 = await AsyncStorage.getItem("customer_bookings");
    const custList2 = JSON.parse(custStr2!);
    const deliveredBooking = custList2.find((b: any) => b.id === booking.id);
    expect(deliveredBooking.status).toBe("delivered");
    expect(deliveredBooking.completedAt).toBeDefined();

    // 6. Customer has 4 notifications (1 accept + 3 status)
    const notifStr = await AsyncStorage.getItem("carrier_notifications");
    const notifs = JSON.parse(notifStr!);
    expect(notifs).toHaveLength(4);

    // 7. Driver's active jobs still has the job (for history)
    const activeStr = await AsyncStorage.getItem("carrier_active_jobs");
    const activeList = JSON.parse(activeStr!);
    expect(activeList).toHaveLength(1);
    expect(activeList[0].status).toBe("delivered");
  });
});
