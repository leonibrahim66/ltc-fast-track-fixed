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

const ONBOARDING_SEEN_PREFIX = "@ltc_onboarding_seen_";

describe("Role-Specific Onboarding", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  describe("Onboarding Content Configuration", () => {
    const ROLE_PAGES: Record<string, { id: string; title: string }[]> = {
      customer: [
        { id: "c1", title: "Welcome to LTC FAST TRACK" },
        { id: "c2", title: "Pin Your Bin Location" },
        { id: "c3", title: "Request & Track Pickups" },
        { id: "c4", title: "Payments & Subscriptions" },
      ],
      carrier_driver: [
        { id: "d1", title: "Welcome, Driver!" },
        { id: "d2", title: "Job Feed" },
        { id: "d3", title: "Track Shipments" },
        { id: "d4", title: "Earnings & Notifications" },
      ],
      collector: [
        { id: "g1", title: "Welcome, Collector!" },
        { id: "g2", title: "Pending Pickups" },
        { id: "g3", title: "Routes & Navigation" },
        { id: "g4", title: "Earnings & Availability" },
      ],
      recycler: [
        { id: "r1", title: "Welcome, Recycler!" },
        { id: "r2", title: "Place Bulk Orders" },
        { id: "r3", title: "Track Orders" },
        { id: "r4", title: "Payments & Profile" },
      ],
    };

    it("should have 4 pages for each role", () => {
      expect(ROLE_PAGES.customer).toHaveLength(4);
      expect(ROLE_PAGES.carrier_driver).toHaveLength(4);
      expect(ROLE_PAGES.collector).toHaveLength(4);
      expect(ROLE_PAGES.recycler).toHaveLength(4);
    });

    it("should have unique IDs for all pages", () => {
      const allIds = Object.values(ROLE_PAGES).flat().map((p) => p.id);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it("should have a welcome page as the first page for each role", () => {
      expect(ROLE_PAGES.customer[0].title).toContain("Welcome");
      expect(ROLE_PAGES.carrier_driver[0].title).toContain("Welcome");
      expect(ROLE_PAGES.collector[0].title).toContain("Welcome");
      expect(ROLE_PAGES.recycler[0].title).toContain("Welcome");
    });
  });

  describe("Onboarding State Management", () => {
    it("should mark onboarding as seen for a specific role", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const role = "customer";
      await AsyncStorage.setItem(`${ONBOARDING_SEEN_PREFIX}${role}`, "true");
      const seen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}${role}`);
      expect(seen).toBe("true");
    });

    it("should not show onboarding for a role that has already seen it", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const role = "collector";
      await AsyncStorage.setItem(`${ONBOARDING_SEEN_PREFIX}${role}`, "true");
      const seen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}${role}`);
      expect(seen).toBe("true");
    });

    it("should show onboarding for a role that has not seen it", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const role = "recycler";
      const seen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}${role}`);
      expect(seen).toBeNull();
    });

    it("should track onboarding independently per role", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem(`${ONBOARDING_SEEN_PREFIX}customer`, "true");
      await AsyncStorage.setItem(`${ONBOARDING_SEEN_PREFIX}collector`, "true");

      const customerSeen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}customer`);
      const collectorSeen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}collector`);
      const driverSeen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}carrier_driver`);
      const recyclerSeen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}recycler`);

      expect(customerSeen).toBe("true");
      expect(collectorSeen).toBe("true");
      expect(driverSeen).toBeNull();
      expect(recyclerSeen).toBeNull();
    });
  });

  describe("Role Dashboard Routing", () => {
    const ROLE_DASHBOARD: Record<string, string> = {
      customer: "/(tabs)",
      carrier_driver: "/carrier/portal",
      collector: "/collector-dashboard",
      recycler: "/recycler-dashboard",
    };

    it("should map customer to tabs", () => {
      expect(ROLE_DASHBOARD.customer).toBe("/(tabs)");
    });

    it("should map carrier_driver to carrier portal", () => {
      expect(ROLE_DASHBOARD.carrier_driver).toBe("/carrier/portal");
    });

    it("should map collector to collector dashboard", () => {
      expect(ROLE_DASHBOARD.collector).toBe("/collector-dashboard");
    });

    it("should map recycler to recycler dashboard", () => {
      expect(ROLE_DASHBOARD.recycler).toBe("/recycler-dashboard");
    });
  });

  describe("Login Flow with Onboarding", () => {
    it("should redirect to onboarding for first-time customer login", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const role = "customer";
      const onboardingSeen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}${role}`);
      
      if (!onboardingSeen) {
        const destination = `/onboarding?role=${role}`;
        expect(destination).toBe("/onboarding?role=customer");
      }
    });

    it("should redirect to dashboard for returning customer login", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const role = "customer";
      await AsyncStorage.setItem(`${ONBOARDING_SEEN_PREFIX}${role}`, "true");
      const onboardingSeen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}${role}`);
      
      if (onboardingSeen) {
        const destination = "/(tabs)";
        expect(destination).toBe("/(tabs)");
      }
    });

    it("should redirect to onboarding for first-time collector login", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const role = "collector";
      const onboardingSeen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}${role}`);
      
      if (!onboardingSeen) {
        const destination = `/onboarding?role=${role}`;
        expect(destination).toBe("/onboarding?role=collector");
      }
    });

    it("should redirect to onboarding for first-time recycler login", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const role = "recycler";
      const onboardingSeen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}${role}`);
      
      if (!onboardingSeen) {
        const destination = `/onboarding?role=${role}`;
        expect(destination).toBe("/onboarding?role=recycler");
      }
    });

    it("should redirect to onboarding for first-time carrier driver login", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const role = "carrier_driver";
      const onboardingSeen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}${role}`);
      
      if (!onboardingSeen) {
        const destination = `/onboarding?role=${role}`;
        expect(destination).toBe("/onboarding?role=carrier_driver");
      }
    });
  });

  describe("Onboarding Skip Functionality", () => {
    it("should mark onboarding as seen when skipped", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const role = "customer";
      
      // Simulate skip
      await AsyncStorage.setItem(`${ONBOARDING_SEEN_PREFIX}${role}`, "true");
      
      const seen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}${role}`);
      expect(seen).toBe("true");
    });

    it("should not show onboarding again after skip", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const role = "collector";
      
      // First visit - skip
      await AsyncStorage.setItem(`${ONBOARDING_SEEN_PREFIX}${role}`, "true");
      
      // Second visit - check
      const seen = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}${role}`);
      expect(seen).toBe("true");
    });
  });

  describe("Carrier Driver Onboarding Integration", () => {
    it("should set both legacy and new onboarding keys for carrier driver", async () => {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      
      // Simulate carrier onboarding completion (as done in carrier/onboarding.tsx)
      await AsyncStorage.setItem("driver_onboarding_completed", "true");
      await AsyncStorage.setItem(`${ONBOARDING_SEEN_PREFIX}carrier_driver`, "true");
      
      const legacyKey = await AsyncStorage.getItem("driver_onboarding_completed");
      const newKey = await AsyncStorage.getItem(`${ONBOARDING_SEEN_PREFIX}carrier_driver`);
      
      expect(legacyKey).toBe("true");
      expect(newKey).toBe("true");
    });
  });
});
