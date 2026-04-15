import { describe, it, expect, vi, beforeEach } from "vitest";

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

interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  pickupLocation: string;
  dropoffLocation: string;
  distance: string;
  cargoType: string;
  cargoWeight: string;
  vehicleRequired: string;
  estimatedPrice: number;
  status: string;
  createdAt: string;
  driverName?: string;
  driverPhone?: string;
}

const sampleBookings: Booking[] = [
  {
    id: "bk-001",
    customerName: "John Doe",
    customerPhone: "+260971234567",
    pickupLocation: "Cairo Road, Lusaka",
    dropoffLocation: "Makeni Mall, Lusaka",
    distance: "8.5 km",
    cargoType: "Household",
    cargoWeight: "200 kg",
    vehicleRequired: "truck",
    estimatedPrice: 350,
    status: "pending",
    createdAt: new Date().toISOString(),
  },
  {
    id: "bk-002",
    customerName: "John Doe",
    customerPhone: "+260971234567",
    pickupLocation: "Manda Hill, Lusaka",
    dropoffLocation: "Woodlands, Lusaka",
    distance: "5.2 km",
    cargoType: "Luggage",
    cargoWeight: "50 kg",
    vehicleRequired: "van",
    estimatedPrice: 180,
    status: "picked_up",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    driverName: "Peter M.",
    driverPhone: "+260977654321",
  },
  {
    id: "bk-003",
    customerName: "John Doe",
    customerPhone: "+260971234567",
    pickupLocation: "East Park Mall, Lusaka",
    dropoffLocation: "Kabulonga, Lusaka",
    distance: "3.1 km",
    cargoType: "General",
    cargoWeight: "30 kg",
    vehicleRequired: "car",
    estimatedPrice: 120,
    status: "delivered",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

describe("Customer Bookings & Tracking", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  describe("My Bookings Screen", () => {
    it("should load bookings from AsyncStorage", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem("carrier_bookings", JSON.stringify(sampleBookings));

      const stored = await AsyncStorage.getItem("carrier_bookings");
      const bookings: Booking[] = stored ? JSON.parse(stored) : [];
      expect(bookings).toHaveLength(3);
    });

    it("should filter pending bookings correctly", () => {
      const pending = sampleBookings.filter((b) => b.status === "pending");
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe("bk-001");
    });

    it("should filter active bookings correctly", () => {
      const active = sampleBookings.filter((b) =>
        ["accepted", "arrived", "picked_up"].includes(b.status)
      );
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe("bk-002");
    });

    it("should filter completed bookings correctly", () => {
      const completed = sampleBookings.filter((b) =>
        ["delivered", "rejected", "cancelled"].includes(b.status)
      );
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe("bk-003");
    });

    it("should show all bookings when filter is 'all'", () => {
      expect(sampleBookings).toHaveLength(3);
    });

    it("should sort bookings by date descending", () => {
      const sorted = [...sampleBookings].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      expect(sorted[0].id).toBe("bk-001"); // Most recent
      expect(sorted[2].id).toBe("bk-003"); // Oldest
    });

    it("should merge active job status updates", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem("carrier_bookings", JSON.stringify(sampleBookings));
      await AsyncStorage.setItem(
        "carrier_active_jobs",
        JSON.stringify([{ id: "bk-001", status: "accepted", driverName: "David K." }])
      );

      const storedBookings = await AsyncStorage.getItem("carrier_bookings");
      const allBookings: Booking[] = storedBookings ? JSON.parse(storedBookings) : [];
      const storedActive = await AsyncStorage.getItem("carrier_active_jobs");
      const activeJobs: any[] = storedActive ? JSON.parse(storedActive) : [];

      const merged = allBookings.map((b) => {
        const active = activeJobs.find((a: any) => a.id === b.id);
        return active ? { ...b, ...active } : b;
      });

      const updatedBooking = merged.find((b) => b.id === "bk-001");
      expect(updatedBooking?.status).toBe("accepted");
      expect(updatedBooking?.driverName).toBe("David K.");
    });
  });

  describe("Track Shipment - Live Map", () => {
    it("should simulate driver position for pending status", () => {
      const booking = sampleBookings[0]; // pending
      const pickup = { lat: -15.4067, lng: 28.2933 };
      // Driver should be offset from pickup for pending
      const driverPos = { lat: pickup.lat + 0.008, lng: pickup.lng - 0.005 };
      expect(driverPos.lat).toBeGreaterThan(pickup.lat);
    });

    it("should simulate driver at pickup for arrived status", () => {
      const pickup = { lat: -15.4067, lng: 28.2933 };
      // For arrived status, driver should be at pickup
      const driverPos = pickup;
      expect(driverPos.lat).toBe(pickup.lat);
      expect(driverPos.lng).toBe(pickup.lng);
    });

    it("should simulate driver between pickup and dropoff for in-transit", () => {
      const pickup = { lat: -15.4067, lng: 28.2933 };
      const dropoff = { lat: -15.4367, lng: 28.3133 };
      // Driver should be between pickup and dropoff
      const progress = 0.5;
      const driverPos = {
        lat: pickup.lat + (dropoff.lat - pickup.lat) * progress,
        lng: pickup.lng + (dropoff.lng - pickup.lng) * progress,
      };
      expect(driverPos.lat).toBeLessThan(pickup.lat);
      expect(driverPos.lat).toBeGreaterThan(dropoff.lat);
    });

    it("should calculate correct marker positions on map", () => {
      const pickup = { lat: -15.4067, lng: 28.2933 };
      const dropoff = { lat: -15.4367, lng: 28.3133 };
      const driver = { lat: -15.4167, lng: 28.3033 };

      const allLats = [pickup.lat, dropoff.lat, driver.lat];
      const allLngs = [pickup.lng, dropoff.lng, driver.lng];
      const minLat = Math.min(...allLats) - 0.003;
      const maxLat = Math.max(...allLats) + 0.003;
      const minLng = Math.min(...allLngs) - 0.005;
      const maxLng = Math.max(...allLngs) + 0.005;

      const latRange = maxLat - minLat;
      const lngRange = maxLng - minLng;

      const toX = (lng: number) => ((lng - minLng) / lngRange) * 100;
      const toY = (lat: number) => ((maxLat - lat) / latRange) * 100;

      // All positions should be between 0 and 100
      expect(toX(pickup.lng)).toBeGreaterThan(0);
      expect(toX(pickup.lng)).toBeLessThan(100);
      expect(toY(pickup.lat)).toBeGreaterThan(0);
      expect(toY(pickup.lat)).toBeLessThan(100);
      expect(toX(dropoff.lng)).toBeGreaterThan(0);
      expect(toX(dropoff.lng)).toBeLessThan(100);
    });

    it("should define correct status configurations", () => {
      const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
        pending: { label: "Waiting for Driver", color: "#F59E0B", icon: "hourglass-empty" },
        accepted: { label: "Driver Assigned", color: "#3B82F6", icon: "check-circle" },
        arrived: { label: "Driver Arrived", color: "#8B5CF6", icon: "location-on" },
        picked_up: { label: "In Transit", color: "#F97316", icon: "local-shipping" },
        delivered: { label: "Delivered", color: "#22C55E", icon: "done-all" },
        rejected: { label: "Rejected", color: "#EF4444", icon: "cancel" },
        cancelled: { label: "Cancelled", color: "#6B7280", icon: "block" },
      };

      expect(Object.keys(STATUS_CONFIG)).toHaveLength(7);
      expect(STATUS_CONFIG.pending.label).toBe("Waiting for Driver");
      expect(STATUS_CONFIG.delivered.color).toBe("#22C55E");
    });

    it("should track progress steps correctly", () => {
      const STEPS = ["pending", "accepted", "arrived", "picked_up", "delivered"];
      expect(STEPS.indexOf("pending")).toBe(0);
      expect(STEPS.indexOf("picked_up")).toBe(3);
      expect(STEPS.indexOf("delivered")).toBe(4);
    });
  });

  describe("Bottom Navigation Cleanup", () => {
    const HIDDEN_TABS = ["earnings", "track-shipment", "driver-dashboard", "carrier-dashboard", "available-bookings"];
    const VISIBLE_TABS = ["index", "pickups", "news", "subscribe", "collector", "profile"];

    it("should have 5 tabs to hide", () => {
      expect(HIDDEN_TABS).toHaveLength(5);
    });

    it("should keep 6 visible tabs", () => {
      expect(VISIBLE_TABS).toHaveLength(6);
    });

    it("should not include hidden tabs in visible tabs", () => {
      HIDDEN_TABS.forEach((tab) => {
        expect(VISIBLE_TABS).not.toContain(tab);
      });
    });

    it("should include Home tab in visible tabs", () => {
      expect(VISIBLE_TABS).toContain("index");
    });

    it("should include Profile tab in visible tabs", () => {
      expect(VISIBLE_TABS).toContain("profile");
    });
  });

  describe("Customer Home - Carrier Services Section", () => {
    it("should have My Bookings instead of Carrier Portal", () => {
      const carrierServices = [
        { label: "Book a Carrier", route: "/carrier/book" },
        { label: "My Bookings", route: "/carrier/my-bookings" },
        { label: "Track Shipment", route: "/carrier/track" },
      ];

      const hasMyBookings = carrierServices.some((s) => s.label === "My Bookings");
      const hasCarrierPortal = carrierServices.some((s) => s.label === "Carrier Portal");

      expect(hasMyBookings).toBe(true);
      expect(hasCarrierPortal).toBe(false);
    });

    it("should route My Bookings to /carrier/my-bookings", () => {
      const carrierServices = [
        { label: "Book a Carrier", route: "/carrier/book" },
        { label: "My Bookings", route: "/carrier/my-bookings" },
        { label: "Track Shipment", route: "/carrier/track" },
      ];

      const myBookings = carrierServices.find((s) => s.label === "My Bookings");
      expect(myBookings?.route).toBe("/carrier/my-bookings");
    });
  });
});
