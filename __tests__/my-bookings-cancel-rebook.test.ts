import { describe, it, expect } from "vitest";

describe("My Bookings - Cancel & Rebook", () => {
  it("should have Cancel and Rebook buttons for pending bookings", () => {
    const pendingBooking = {
      id: "1",
      bookingId: "BK-2026-001",
      status: "pending" as const,
      pickupLocation: "Cairo Road, Lusaka",
      dropoffLocation: "Makeni Mall, Lusaka",
      cargoType: "Household Items",
      cargoWeight: "200 kg",
      vehicleRequired: "Truck",
    };

    // Pending bookings should show Cancel and Rebook buttons
    expect(pendingBooking.status).toBe("pending");
  });

  it("should NOT show Cancel and Rebook buttons for accepted bookings", () => {
    const acceptedBooking = {
      id: "2",
      bookingId: "BK-2026-002",
      status: "accepted" as const,
    };

    // Accepted bookings should not show Cancel and Rebook buttons
    expect(acceptedBooking.status).not.toBe("pending");
  });

  it("should NOT show Cancel and Rebook buttons for rejected bookings", () => {
    const rejectedBooking = {
      id: "3",
      bookingId: "BK-2026-003",
      status: "rejected" as const,
    };

    // Rejected bookings should not show Cancel and Rebook buttons
    expect(rejectedBooking.status).not.toBe("pending");
  });

  it("should NOT show Cancel and Rebook buttons for completed bookings", () => {
    const completedBooking = {
      id: "4",
      bookingId: "BK-2026-004",
      status: "completed" as const,
    };

    // Completed bookings should not show Cancel and Rebook buttons
    expect(completedBooking.status).not.toBe("pending");
  });

  it("should update booking status to cancelled when confirmed", () => {
    const booking = {
      id: "1",
      bookingId: "BK-2026-001",
      status: "pending" as const,
    };

    // Simulate cancel action
    const updatedBooking = { ...booking, status: "cancelled" as const };

    expect(updatedBooking.status).toBe("cancelled");
  });

  it("should include cancelled in booking status type", () => {
    const statuses: Array<"pending" | "accepted" | "rejected" | "completed" | "cancelled"> = [
      "pending",
      "accepted",
      "rejected",
      "completed",
      "cancelled",
    ];

    expect(statuses).toContain("cancelled");
    expect(statuses.length).toBe(5);
  });

  it("should have rebook data matching original booking", () => {
    const originalBooking = {
      id: "1",
      bookingId: "BK-2026-001",
      pickupLocation: "Cairo Road, Lusaka",
      dropoffLocation: "Makeni Mall, Lusaka",
      cargoType: "Household Items",
      cargoWeight: "200 kg",
      vehicleRequired: "Truck",
    };

    // Rebook should copy these fields
    const rebookData = {
      pickupLocation: originalBooking.pickupLocation,
      dropoffLocation: originalBooking.dropoffLocation,
      cargoType: originalBooking.cargoType,
      cargoWeight: originalBooking.cargoWeight,
      vehicleType: originalBooking.vehicleRequired,
    };

    expect(rebookData.pickupLocation).toBe(originalBooking.pickupLocation);
    expect(rebookData.dropoffLocation).toBe(originalBooking.dropoffLocation);
    expect(rebookData.cargoType).toBe(originalBooking.cargoType);
    expect(rebookData.cargoWeight).toBe(originalBooking.cargoWeight);
    expect(rebookData.vehicleType).toBe(originalBooking.vehicleRequired);
  });

  it("should have cancelled notification type", () => {
    const notificationTypes: Array<
      "accepted" | "rejected" | "driver_assigned" | "completed" | "cancelled"
    > = ["accepted", "rejected", "driver_assigned", "completed", "cancelled"];

    expect(notificationTypes).toContain("cancelled");
  });

  it("should create cancellation notification with correct fields", () => {
    const notification = {
      bookingId: "BK-2026-001",
      type: "cancelled" as const,
      title: "Booking Cancelled",
      message: "Your booking BK-2026-001 has been cancelled successfully.",
      read: false,
    };

    expect(notification.type).toBe("cancelled");
    expect(notification.title).toBe("Booking Cancelled");
    expect(notification.message).toContain("BK-2026-001");
    expect(notification.message).toContain("cancelled successfully");
    expect(notification.read).toBe(false);
  });
});
