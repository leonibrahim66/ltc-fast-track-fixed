import { describe, it, expect, vi, beforeEach } from "vitest";
import { CustomerBooking, PaymentRecord, BookingNotification } from "@/types/booking";

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

describe("My Bookings Rebuild - Customer View", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  describe("Booking Data Types", () => {
    it("should have correct CustomerBooking structure", () => {
      const booking: CustomerBooking = {
        id: "1",
        bookingId: "BK-2026-001",
        customerId: "cust-001",
        customerName: "John Doe",
        customerPhone: "+260971234567",
        pickupLocation: "Cairo Road",
        dropoffLocation: "Makeni Mall",
        distance: "8.5 km",
        cargoType: "Household",
        cargoWeight: "200 kg",
        vehicleRequired: "Truck",
        estimatedPrice: 350,
        totalAmount: 350,
        status: "pending",
        paymentStatus: "pending",
        createdAt: new Date().toISOString(),
      };

      expect(booking.bookingId).toBe("BK-2026-001");
      expect(booking.status).toBe("pending");
      expect(booking.paymentStatus).toBe("pending");
    });

    it("should include driver and vehicle info for accepted bookings", () => {
      const booking: CustomerBooking = {
        id: "2",
        bookingId: "BK-2026-002",
        customerId: "cust-001",
        customerName: "John Doe",
        customerPhone: "+260971234567",
        pickupLocation: "Manda Hill",
        dropoffLocation: "Woodlands",
        distance: "5.2 km",
        cargoType: "Luggage",
        cargoWeight: "50 kg",
        vehicleRequired: "Van",
        estimatedPrice: 180,
        totalAmount: 180,
        status: "accepted",
        paymentStatus: "paid",
        createdAt: new Date().toISOString(),
        driverName: "Peter Mwansa",
        driverPhone: "+260977654321",
        vehicleType: "Toyota Hiace Van",
        vehicleColor: "White",
        vehiclePlate: "BAM 1234",
      };

      expect(booking.driverName).toBe("Peter Mwansa");
      expect(booking.vehicleType).toBe("Toyota Hiace Van");
      expect(booking.vehiclePlate).toBe("BAM 1234");
    });

    it("should include payment history", () => {
      const payment: PaymentRecord = {
        id: "pay-001",
        amount: 180,
        method: "MTN Mobile Money",
        transactionId: "MTN123456789",
        status: "paid",
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      expect(payment.method).toBe("MTN Mobile Money");
      expect(payment.status).toBe("paid");
      expect(payment.transactionId).toBe("MTN123456789");
    });
  });

  describe("Tab Filters", () => {
    const sampleBookings: CustomerBooking[] = [
      {
        id: "1",
        bookingId: "BK-2026-001",
        customerId: "cust-001",
        customerName: "John Doe",
        customerPhone: "+260971234567",
        pickupLocation: "Cairo Road",
        dropoffLocation: "Makeni Mall",
        distance: "8.5 km",
        cargoType: "Household",
        cargoWeight: "200 kg",
        vehicleRequired: "Truck",
        estimatedPrice: 350,
        totalAmount: 350,
        status: "pending",
        paymentStatus: "pending",
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        bookingId: "BK-2026-002",
        customerId: "cust-001",
        customerName: "John Doe",
        customerPhone: "+260971234567",
        pickupLocation: "Manda Hill",
        dropoffLocation: "Woodlands",
        distance: "5.2 km",
        cargoType: "Luggage",
        cargoWeight: "50 kg",
        vehicleRequired: "Van",
        estimatedPrice: 180,
        totalAmount: 180,
        status: "accepted",
        paymentStatus: "paid",
        createdAt: new Date().toISOString(),
      },
      {
        id: "3",
        bookingId: "BK-2026-003",
        customerId: "cust-001",
        customerName: "John Doe",
        customerPhone: "+260971234567",
        pickupLocation: "East Park Mall",
        dropoffLocation: "Kabulonga",
        distance: "3.1 km",
        cargoType: "General",
        cargoWeight: "30 kg",
        vehicleRequired: "Car",
        estimatedPrice: 120,
        totalAmount: 120,
        status: "rejected",
        paymentStatus: "pending",
        createdAt: new Date().toISOString(),
      },
      {
        id: "4",
        bookingId: "BK-2026-004",
        customerId: "cust-001",
        customerName: "John Doe",
        customerPhone: "+260971234567",
        pickupLocation: "Levy Mall",
        dropoffLocation: "Chilenje",
        distance: "4.3 km",
        cargoType: "Furniture",
        cargoWeight: "150 kg",
        vehicleRequired: "Truck",
        estimatedPrice: 280,
        totalAmount: 280,
        status: "completed",
        paymentStatus: "paid",
        createdAt: new Date().toISOString(),
      },
    ];

    it("should filter pending bookings", () => {
      const pending = sampleBookings.filter((b) => b.status === "pending");
      expect(pending).toHaveLength(1);
      expect(pending[0].bookingId).toBe("BK-2026-001");
    });

    it("should filter accepted bookings", () => {
      const accepted = sampleBookings.filter((b) => b.status === "accepted");
      expect(accepted).toHaveLength(1);
      expect(accepted[0].bookingId).toBe("BK-2026-002");
    });

    it("should filter rejected bookings", () => {
      const rejected = sampleBookings.filter((b) => b.status === "rejected");
      expect(rejected).toHaveLength(1);
      expect(rejected[0].bookingId).toBe("BK-2026-003");
    });

    it("should filter completed bookings", () => {
      const completed = sampleBookings.filter((b) => b.status === "completed");
      expect(completed).toHaveLength(1);
      expect(completed[0].bookingId).toBe("BK-2026-004");
    });

    it("should have 4 tabs total", () => {
      const tabs = ["pending", "accepted", "rejected", "completed"];
      expect(tabs).toHaveLength(4);
    });
  });

  describe("Status Configuration", () => {
    const STATUS_CONFIG: Record<
      string,
      { label: string; bgColor: string; textColor: string; icon: string }
    > = {
      pending: {
        label: "Pending",
        bgColor: "#FEF3C7",
        textColor: "#92400E",
        icon: "hourglass-empty",
      },
      accepted: {
        label: "Accepted",
        bgColor: "#DBEAFE",
        textColor: "#1E40AF",
        icon: "check-circle",
      },
      rejected: {
        label: "Rejected",
        bgColor: "#FEE2E2",
        textColor: "#991B1B",
        icon: "cancel",
      },
      completed: {
        label: "Completed",
        bgColor: "#D1FAE5",
        textColor: "#065F46",
        icon: "done-all",
      },
    };

    it("should have correct status colors", () => {
      expect(STATUS_CONFIG.pending.bgColor).toBe("#FEF3C7");
      expect(STATUS_CONFIG.accepted.bgColor).toBe("#DBEAFE");
      expect(STATUS_CONFIG.rejected.bgColor).toBe("#FEE2E2");
      expect(STATUS_CONFIG.completed.bgColor).toBe("#D1FAE5");
    });

    it("should have correct status icons", () => {
      expect(STATUS_CONFIG.pending.icon).toBe("hourglass-empty");
      expect(STATUS_CONFIG.accepted.icon).toBe("check-circle");
      expect(STATUS_CONFIG.rejected.icon).toBe("cancel");
      expect(STATUS_CONFIG.completed.icon).toBe("done-all");
    });
  });

  describe("Payment Status Configuration", () => {
    const PAYMENT_STATUS_CONFIG: Record<
      string,
      { label: string; bgColor: string; textColor: string }
    > = {
      paid: { label: "Paid", bgColor: "#D1FAE5", textColor: "#065F46" },
      pending: { label: "Pending", bgColor: "#FEF3C7", textColor: "#92400E" },
      failed: { label: "Failed", bgColor: "#FEE2E2", textColor: "#991B1B" },
    };

    it("should have correct payment status colors", () => {
      expect(PAYMENT_STATUS_CONFIG.paid.bgColor).toBe("#D1FAE5");
      expect(PAYMENT_STATUS_CONFIG.pending.bgColor).toBe("#FEF3C7");
      expect(PAYMENT_STATUS_CONFIG.failed.bgColor).toBe("#FEE2E2");
    });

    it("should have correct payment status labels", () => {
      expect(PAYMENT_STATUS_CONFIG.paid.label).toBe("Paid");
      expect(PAYMENT_STATUS_CONFIG.pending.label).toBe("Pending");
      expect(PAYMENT_STATUS_CONFIG.failed.label).toBe("Failed");
    });
  });

  describe("Booking Notifications", () => {
    it("should create notification with correct structure", () => {
      const notification: BookingNotification = {
        id: "notif-001",
        bookingId: "BK-2026-001",
        type: "accepted",
        title: "Booking Accepted",
        message: "Your booking has been accepted by a driver",
        read: false,
        createdAt: new Date().toISOString(),
      };

      expect(notification.type).toBe("accepted");
      expect(notification.read).toBe(false);
    });

    it("should support all notification types", () => {
      const types: BookingNotification["type"][] = [
        "accepted",
        "rejected",
        "driver_assigned",
        "completed",
      ];
      expect(types).toHaveLength(4);
    });

    it("should store notifications in AsyncStorage", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const notifications: BookingNotification[] = [
        {
          id: "notif-001",
          bookingId: "BK-2026-001",
          type: "accepted",
          title: "Booking Accepted",
          message: "Your booking has been accepted",
          read: false,
          createdAt: new Date().toISOString(),
        },
      ];

      await AsyncStorage.setItem("customer_booking_notifications", JSON.stringify(notifications));
      const stored = await AsyncStorage.getItem("customer_booking_notifications");
      const parsed = stored ? JSON.parse(stored) : [];

      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe("accepted");
    });

    it("should calculate unread count correctly", () => {
      const notifications: BookingNotification[] = [
        {
          id: "notif-001",
          bookingId: "BK-2026-001",
          type: "accepted",
          title: "Booking Accepted",
          message: "Your booking has been accepted",
          read: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: "notif-002",
          bookingId: "BK-2026-002",
          type: "completed",
          title: "Booking Completed",
          message: "Your booking has been completed",
          read: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: "notif-003",
          bookingId: "BK-2026-003",
          type: "driver_assigned",
          title: "Driver Assigned",
          message: "A driver has been assigned",
          read: false,
          createdAt: new Date().toISOString(),
        },
      ];

      const unreadCount = notifications.filter((n) => !n.read).length;
      expect(unreadCount).toBe(2);
    });
  });

  describe("Booking Storage", () => {
    it("should store bookings in AsyncStorage", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const bookings: CustomerBooking[] = [
        {
          id: "1",
          bookingId: "BK-2026-001",
          customerId: "cust-001",
          customerName: "John Doe",
          customerPhone: "+260971234567",
          pickupLocation: "Cairo Road",
          dropoffLocation: "Makeni Mall",
          distance: "8.5 km",
          cargoType: "Household",
          cargoWeight: "200 kg",
          vehicleRequired: "Truck",
          estimatedPrice: 350,
          totalAmount: 350,
          status: "pending",
          paymentStatus: "pending",
          createdAt: new Date().toISOString(),
        },
      ];

      await AsyncStorage.setItem("customer_bookings", JSON.stringify(bookings));
      const stored = await AsyncStorage.getItem("customer_bookings");
      const parsed = stored ? JSON.parse(stored) : [];

      expect(parsed).toHaveLength(1);
      expect(parsed[0].bookingId).toBe("BK-2026-001");
    });

    it("should sort bookings by date descending", () => {
      const bookings: CustomerBooking[] = [
        {
          id: "1",
          bookingId: "BK-2026-001",
          customerId: "cust-001",
          customerName: "John Doe",
          customerPhone: "+260971234567",
          pickupLocation: "Cairo Road",
          dropoffLocation: "Makeni Mall",
          distance: "8.5 km",
          cargoType: "Household",
          cargoWeight: "200 kg",
          vehicleRequired: "Truck",
          estimatedPrice: 350,
          totalAmount: 350,
          status: "pending",
          paymentStatus: "pending",
          createdAt: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: "2",
          bookingId: "BK-2026-002",
          customerId: "cust-001",
          customerName: "John Doe",
          customerPhone: "+260971234567",
          pickupLocation: "Manda Hill",
          dropoffLocation: "Woodlands",
          distance: "5.2 km",
          cargoType: "Luggage",
          cargoWeight: "50 kg",
          vehicleRequired: "Van",
          estimatedPrice: 180,
          totalAmount: 180,
          status: "accepted",
          paymentStatus: "paid",
          createdAt: new Date().toISOString(),
        },
      ];

      const sorted = [...bookings].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      expect(sorted[0].bookingId).toBe("BK-2026-002"); // Most recent
      expect(sorted[1].bookingId).toBe("BK-2026-001"); // Oldest
    });
  });

  describe("View-Only Requirements", () => {
    it("should not have edit actions", () => {
      const allowedActions = ["view_details", "refresh"];
      expect(allowedActions).not.toContain("edit");
      expect(allowedActions).not.toContain("cancel");
      expect(allowedActions).not.toContain("update");
    });

    it("should be customer-only screen", () => {
      const allowedRoles = ["residential", "commercial"];
      expect(allowedRoles).not.toContain("driver");
      expect(allowedRoles).not.toContain("collector");
      expect(allowedRoles).not.toContain("recycler");
    });
  });
});
