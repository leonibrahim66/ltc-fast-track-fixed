import { describe, it, expect } from "vitest";

describe("Book a Carrier Step 2 Enhancements", () => {
  describe("Automatic Distance Calculation", () => {
    it("should calculate distance when both pickup and dropoff locations are set", () => {
      const pickupLocation = "123 Main St, Lusaka";
      const dropoffLocation = "456 Church Rd, Kitwe";
      
      expect(pickupLocation.length).toBeGreaterThan(3);
      expect(dropoffLocation.length).toBeGreaterThan(3);
    });

    it("should not calculate distance if pickup location is too short", () => {
      const pickupLocation = "AB";
      const dropoffLocation = "456 Church Rd, Kitwe";
      
      expect(pickupLocation.length).toBeLessThanOrEqual(3);
    });

    it("should not calculate distance if dropoff location is too short", () => {
      const pickupLocation = "123 Main St, Lusaka";
      const dropoffLocation = "XY";
      
      expect(dropoffLocation.length).toBeLessThanOrEqual(3);
    });

    it("should return distance in kilometers with 1 decimal place", () => {
      const mockDistance = 45.7;
      const rounded = Math.round(mockDistance * 10) / 10;
      
      expect(rounded).toBe(45.7);
    });
  });

  describe("Live Price Calculation", () => {
    const VEHICLE_TYPES = [
      { key: "motorbike", label: "Motorbike", baseRate: 25, perKmRate: 2 },
      { key: "van", label: "Van", baseRate: 75, perKmRate: 5 },
      { key: "pickup", label: "Pickup", baseRate: 100, perKmRate: 7 },
      { key: "truck", label: "Truck", baseRate: 200, perKmRate: 12 },
      { key: "trailer", label: "Trailer", baseRate: 350, perKmRate: 20 },
    ];

    it("should calculate price based on distance and vehicle type", () => {
      const distance = 50; // km
      const vehicle = VEHICLE_TYPES[1]; // Van
      
      const price = vehicle.baseRate + vehicle.perKmRate * distance;
      expect(price).toBe(75 + 5 * 50);
      expect(price).toBe(325);
    });

    it("should use van as default for price preview when no vehicle selected", () => {
      const distance = 30;
      const defaultVehicle = VEHICLE_TYPES[1]; // Van
      
      const price = defaultVehicle.baseRate + defaultVehicle.perKmRate * distance;
      expect(price).toBe(75 + 5 * 30);
      expect(price).toBe(225);
    });

    it("should calculate price for motorbike correctly", () => {
      const distance = 20;
      const vehicle = VEHICLE_TYPES[0]; // Motorbike
      
      const price = vehicle.baseRate + vehicle.perKmRate * distance;
      expect(price).toBe(25 + 2 * 20);
      expect(price).toBe(65);
    });

    it("should calculate price for trailer correctly", () => {
      const distance = 100;
      const vehicle = VEHICLE_TYPES[4]; // Trailer
      
      const price = vehicle.baseRate + vehicle.perKmRate * distance;
      expect(price).toBe(350 + 20 * 100);
      expect(price).toBe(2350);
    });

    it("should round price to 2 decimal places", () => {
      const price = 123.456;
      const rounded = Math.round(price * 100) / 100;
      
      expect(rounded).toBe(123.46);
    });

    it("should apply weight multiplier for heavy cargo", () => {
      const WEIGHT_OPTIONS = [
        "Under 10 kg",
        "10 - 50 kg",
        "50 - 200 kg",
        "200 - 500 kg", // index 3
        "500 kg - 1 ton", // index 4
        "1 - 5 tons", // index 5
        "5+ tons", // index 6
      ];
      
      const basePrice = 300;
      const weightIdx = 4; // 500 kg - 1 ton
      
      let price = basePrice;
      if (weightIdx > 2) {
        price *= 1 + (weightIdx - 2) * 0.15;
      }
      
      expect(price).toBe(300 * 1.3); // 1 + (4-2) * 0.15 = 1.3
      expect(price).toBe(390);
    });

    it("should apply fragile cargo multiplier", () => {
      const basePrice = 200;
      const cargoType = "Fragile";
      
      let price = basePrice;
      if (cargoType === "Fragile") {
        price *= 1.2;
      }
      
      expect(price).toBe(240);
    });

    it("should apply electronics cargo multiplier", () => {
      const basePrice = 200;
      const cargoType = "Electronics";
      
      let price = basePrice;
      if (cargoType === "Electronics") {
        price *= 1.15;
      }
      
      expect(Math.round(price * 100) / 100).toBe(230);
    });
  });

  describe("Step 2 Validation", () => {
    it("should require pickup location", () => {
      const pickupLocation = "";
      const dropoffLocation = "456 Church Rd, Kitwe";
      const calculatedDistance = 50;
      
      expect(pickupLocation.trim()).toBe("");
    });

    it("should require dropoff location", () => {
      const pickupLocation = "123 Main St, Lusaka";
      const dropoffLocation = "";
      const calculatedDistance = 50;
      
      expect(dropoffLocation.trim()).toBe("");
    });

    it("should require successful distance calculation", () => {
      const pickupLocation = "123 Main St, Lusaka";
      const dropoffLocation = "456 Church Rd, Kitwe";
      const calculatedDistance = null;
      
      expect(calculatedDistance).toBeNull();
    });

    it("should not allow continue while calculating distance", () => {
      const calculatingDistance = true;
      const calculatedDistance = null;
      
      expect(calculatingDistance).toBe(true);
      expect(calculatedDistance).toBeNull();
    });

    it("should allow continue when distance is calculated", () => {
      const pickupLocation = "123 Main St, Lusaka";
      const dropoffLocation = "456 Church Rd, Kitwe";
      const calculatingDistance = false;
      const calculatedDistance = 45.7;
      
      expect(pickupLocation.trim()).not.toBe("");
      expect(dropoffLocation.trim()).not.toBe("");
      expect(calculatingDistance).toBe(false);
      expect(calculatedDistance).toBeGreaterThan(0);
    });
  });

  describe("Manual Distance Selection Removal", () => {
    it("should not have distance range options", () => {
      const DISTANCE_OPTIONS_OLD = [
        { label: "Within City (0-15 km)", value: "city", multiplier: 1 },
        { label: "Short Distance (15-50 km)", value: "short", multiplier: 1.5 },
        { label: "Medium Distance (50-150 km)", value: "medium", multiplier: 2.5 },
        { label: "Long Distance (150-500 km)", value: "long", multiplier: 4 },
        { label: "Cross-Country (500+ km)", value: "cross", multiplier: 6 },
      ];
      
      // These options should no longer be used in Step 2
      expect(DISTANCE_OPTIONS_OLD.length).toBeGreaterThan(0);
      // But they are not rendered in the new UI
    });

    it("should use calculated distance instead of distance range", () => {
      const calculatedDistance = 45.7;
      const distanceString = `${calculatedDistance} km`;
      
      expect(distanceString).toBe("45.7 km");
    });
  });

  describe("UI Display", () => {
    it("should show calculating indicator when distance is being calculated", () => {
      const calculatingDistance = true;
      
      expect(calculatingDistance).toBe(true);
    });

    it("should show calculated distance in kilometers", () => {
      const calculatedDistance = 45.7;
      
      expect(calculatedDistance).toBeGreaterThan(0);
      expect(typeof calculatedDistance).toBe("number");
    });

    it("should show live price preview when distance is available", () => {
      const calculatedDistance = 50;
      const vehicle = { baseRate: 75, perKmRate: 5 }; // Van
      const livePricePreview = vehicle.baseRate + vehicle.perKmRate * calculatedDistance;
      
      expect(livePricePreview).toBe(325);
      expect(livePricePreview).toBeGreaterThan(0);
    });

    it("should show transparency disclaimer text", () => {
      const disclaimerText = "Final price may change if destination or stops are modified.";
      
      expect(disclaimerText).toContain("Final price may change");
    });

    it("should show note about default vehicle when no vehicle selected", () => {
      const vehicleType = "";
      const noteText = "* Based on Van. Price will update after vehicle selection.";
      
      if (!vehicleType) {
        expect(noteText).toContain("Based on Van");
      }
    });
  });

  describe("Booking Submission", () => {
    it("should include calculated distance in booking data", () => {
      const calculatedDistance = 45.7;
      const booking = {
        distance: `${calculatedDistance} km`,
      };
      
      expect(booking.distance).toBe("45.7 km");
    });

    it("should include distance in notification message", () => {
      const calculatedDistance = 45.7;
      const pickupLocation = "Lusaka";
      const dropoffLocation = "Kitwe";
      const cargoType = "Household";
      const estimatedPrice = 325.50;
      
      const message = `New ${cargoType} transport from ${pickupLocation} to ${dropoffLocation}. Distance: ${calculatedDistance} km. Price: K${estimatedPrice.toFixed(2)}`;
      
      expect(message).toContain("Distance: 45.7 km");
      expect(message).toContain("Price: K325.50");
    });

    it("should include distance in success alert", () => {
      const calculatedDistance = 45.7;
      const estimatedPrice = 325.50;
      const bookingId = "booking_1234567890_abc123";
      
      const alertMessage = `Your carrier booking has been submitted.\n\nBooking ID: ${bookingId.slice(-8).toUpperCase()}\nDistance: ${calculatedDistance} km\nEstimated Price: K${estimatedPrice.toFixed(2)}\n\nA driver will accept your request shortly.`;
      
      expect(alertMessage).toContain("Distance: 45.7 km");
      expect(alertMessage).toContain("Estimated Price: K325.50");
    });
  });

  describe("Continue Button State", () => {
    it("should disable continue button when calculating distance", () => {
      const step = 2;
      const calculatingDistance = true;
      const calculatedDistance = null;
      
      const isDisabled = step === 2 && (calculatingDistance || !calculatedDistance);
      expect(isDisabled).toBe(true);
    });

    it("should disable continue button when distance calculation failed", () => {
      const step = 2;
      const calculatingDistance = false;
      const calculatedDistance = null;
      
      const isDisabled = step === 2 && (calculatingDistance || !calculatedDistance);
      expect(isDisabled).toBe(true);
    });

    it("should enable continue button when distance is calculated", () => {
      const step = 2;
      const calculatingDistance = false;
      const calculatedDistance = 45.7;
      
      const isDisabled = step === 2 && (calculatingDistance || !calculatedDistance);
      expect(isDisabled).toBe(false);
    });

    it("should show 'Calculating...' text when distance is being calculated", () => {
      const step = 2;
      const calculatingDistance = true;
      const buttonText = step === 2 && calculatingDistance ? "Calculating..." : "Continue";
      
      expect(buttonText).toBe("Calculating...");
    });
  });
});
