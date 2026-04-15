import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock types for driver dashboard
interface Booking {
  id: number;
  customerId: number;
  driverId: number | null;
  customerName: string;
  customerPhone: string;
  pickupLocation: string;
  dropoffLocation: string;
  cargoType: string | null;
  cargoWeight: string | null;
  estimatedPrice: number | null;
  status: 'pending' | 'accepted' | 'in-progress' | 'completed' | 'rejected' | 'cancelled';
  vehicleRequired: string | null;
  scheduledTime: Date | null;
  completedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Vehicle {
  id: number;
  driverId: number;
  vehicleType: string;
  plateNumber: string;
  capacity: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Driver {
  id: number;
  name: string;
  phone: string;
  role: 'driver';
  vehicle?: Vehicle;
}

// Driver Dashboard Service
class DriverDashboardService {
  private bookings: Booking[] = [];
  private vehicles: Vehicle[] = [];
  private drivers: Driver[] = [];

  // Initialize with mock data
  initializeMockData() {
    this.bookings = [
      {
        id: 1,
        customerId: 100,
        driverId: null,
        customerName: 'John Doe',
        customerPhone: '+260960500656',
        pickupLocation: 'Lusaka City Center',
        dropoffLocation: 'Ndola',
        cargoType: 'General Cargo',
        cargoWeight: '500kg',
        estimatedPrice: 450,
        status: 'pending',
        vehicleRequired: 'Pickup Truck',
        scheduledTime: new Date('2026-01-23T14:00:00'),
        completedAt: null,
        notes: 'Fragile items',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        customerId: 101,
        driverId: null,
        customerName: 'Jane Smith',
        customerPhone: '+260960500657',
        pickupLocation: 'Kitwe',
        dropoffLocation: 'Livingstone',
        cargoType: 'Documents',
        cargoWeight: '5kg',
        estimatedPrice: 150,
        status: 'pending',
        vehicleRequired: 'Motorbike',
        scheduledTime: new Date('2026-01-23T10:00:00'),
        completedAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    this.vehicles = [
      {
        id: 1,
        driverId: 1,
        vehicleType: 'Pickup Truck',
        plateNumber: 'ZMB 123',
        capacity: '1000kg',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    this.drivers = [
      {
        id: 1,
        name: 'James Mwale',
        phone: '+260960500656',
        role: 'driver',
        vehicle: this.vehicles[0],
      },
    ];
  }

  // Get available bookings (pending status)
  getAvailableBookings(): Booking[] {
    return this.bookings.filter((b) => b.status === 'pending');
  }

  // Get bookings assigned to driver
  getDriverBookings(driverId: number): Booking[] {
    return this.bookings.filter((b) => b.driverId === driverId && b.status === 'accepted');
  }

  // Accept booking
  acceptBooking(bookingId: number, driverId: number): boolean {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking || booking.status !== 'pending') {
      return false;
    }
    booking.driverId = driverId;
    booking.status = 'accepted';
    booking.updatedAt = new Date();
    return true;
  }

  // Reject booking
  rejectBooking(bookingId: number): boolean {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking || booking.status !== 'pending') {
      return false;
    }
    booking.status = 'rejected';
    booking.updatedAt = new Date();
    return true;
  }

  // Update booking status
  updateBookingStatus(
    bookingId: number,
    status: 'in-progress' | 'completed' | 'cancelled'
  ): boolean {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return false;
    }
    booking.status = status;
    if (status === 'completed') {
      booking.completedAt = new Date();
    }
    booking.updatedAt = new Date();
    return true;
  }

  // Get booking by ID
  getBookingById(bookingId: number): Booking | null {
    return this.bookings.find((b) => b.id === bookingId) || null;
  }

  // Get completed bookings for driver
  getCompletedBookings(driverId: number): Booking[] {
    return this.bookings.filter((b) => b.driverId === driverId && b.status === 'completed');
  }

  // Get driver by ID
  getDriver(driverId: number): Driver | null {
    return this.drivers.find((d) => d.id === driverId) || null;
  }

  // Get driver's vehicle
  getDriverVehicle(driverId: number): Vehicle | null {
    return this.vehicles.find((v) => v.driverId === driverId && v.isActive) || null;
  }

  // Get all bookings (admin)
  getAllBookings(): Booking[] {
    return this.bookings;
  }

  // Create booking (customer)
  createBooking(data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Booking {
    const booking: Booking = {
      ...data,
      id: Math.max(...this.bookings.map((b) => b.id), 0) + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.bookings.push(booking);
    return booking;
  }
}

describe('Driver Dashboard', () => {
  let service: DriverDashboardService;

  beforeEach(() => {
    service = new DriverDashboardService();
    service.initializeMockData();
  });

  // ============ AVAILABLE BOOKINGS TESTS ============
  describe('Available Bookings', () => {
    it('should retrieve all pending bookings', () => {
      const available = service.getAvailableBookings();
      expect(available.length).toBe(2);
      expect(available.every((b) => b.status === 'pending')).toBe(true);
    });

    it('should not include accepted bookings in available list', () => {
      service.acceptBooking(1, 1);
      const available = service.getAvailableBookings();
      expect(available.length).toBe(1);
      expect(available.find((b) => b.id === 1)).toBeUndefined();
    });

    it('should display customer details in available bookings', () => {
      const available = service.getAvailableBookings();
      const booking = available[0];
      expect(booking.customerName).toBe('John Doe');
      expect(booking.customerPhone).toBe('+260960500656');
      expect(booking.pickupLocation).toBe('Lusaka City Center');
      expect(booking.dropoffLocation).toBe('Ndola');
    });

    it('should show estimated price and vehicle required', () => {
      const available = service.getAvailableBookings();
      const booking = available[0];
      expect(booking.estimatedPrice).toBe(450);
      expect(booking.vehicleRequired).toBe('Pickup Truck');
    });
  });

  // ============ ACCEPT/REJECT BOOKING TESTS ============
  describe('Accept/Reject Bookings', () => {
    it('should accept a pending booking', () => {
      const accepted = service.acceptBooking(1, 1);
      expect(accepted).toBe(true);

      const booking = service.getBookingById(1);
      expect(booking?.status).toBe('accepted');
      expect(booking?.driverId).toBe(1);
    });

    it('should fail to accept non-pending booking', () => {
      service.acceptBooking(1, 1);
      const accepted = service.acceptBooking(1, 2);
      expect(accepted).toBe(false);
    });

    it('should reject a pending booking', () => {
      const rejected = service.rejectBooking(1);
      expect(rejected).toBe(true);

      const booking = service.getBookingById(1);
      expect(booking?.status).toBe('rejected');
    });

    it('should fail to reject non-pending booking', () => {
      service.acceptBooking(1, 1);
      const rejected = service.rejectBooking(1);
      expect(rejected).toBe(false);
    });

    it('should update booking timestamp when accepting', () => {
      const before = new Date();
      service.acceptBooking(1, 1);
      const after = new Date();

      const booking = service.getBookingById(1);
      expect(booking?.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(booking?.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ============ DRIVER BOOKINGS TESTS ============
  describe('Driver Bookings', () => {
    beforeEach(() => {
      service.acceptBooking(1, 1);
      service.acceptBooking(2, 1);
    });

    it('should retrieve driver accepted bookings', () => {
      const driverBookings = service.getDriverBookings(1);
      expect(driverBookings.length).toBe(2);
      expect(driverBookings.every((b) => b.driverId === 1)).toBe(true);
    });

    it('should not include other drivers bookings', () => {
      const driverBookings = service.getDriverBookings(2);
      expect(driverBookings.length).toBe(0);
    });

    it('should only include accepted status bookings', () => {
      const driverBookings = service.getDriverBookings(1);
      expect(driverBookings.every((b) => b.status === 'accepted')).toBe(true);
    });
  });

  // ============ BOOKING STATUS UPDATE TESTS ============
  describe('Update Booking Status', () => {
    beforeEach(() => {
      service.acceptBooking(1, 1);
    });

    it('should update booking to in-progress', () => {
      const updated = service.updateBookingStatus(1, 'in-progress');
      expect(updated).toBe(true);

      const booking = service.getBookingById(1);
      expect(booking?.status).toBe('in-progress');
    });

    it('should update booking to completed', () => {
      service.updateBookingStatus(1, 'in-progress');
      const updated = service.updateBookingStatus(1, 'completed');
      expect(updated).toBe(true);

      const booking = service.getBookingById(1);
      expect(booking?.status).toBe('completed');
    });

    it('should set completedAt timestamp when marking complete', () => {
      const before = new Date();
      service.updateBookingStatus(1, 'completed');
      const after = new Date();

      const booking = service.getBookingById(1);
      expect(booking?.completedAt).toBeDefined();
      expect(booking?.completedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(booking?.completedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should cancel a booking', () => {
      const updated = service.updateBookingStatus(1, 'cancelled');
      expect(updated).toBe(true);

      const booking = service.getBookingById(1);
      expect(booking?.status).toBe('cancelled');
    });

    it('should fail to update non-existent booking', () => {
      const updated = service.updateBookingStatus(999, 'completed');
      expect(updated).toBe(false);
    });
  });

  // ============ DRIVER INFO TESTS ============
  describe('Driver Information', () => {
    it('should retrieve driver by ID', () => {
      const driver = service.getDriver(1);
      expect(driver).toBeDefined();
      expect(driver?.name).toBe('James Mwale');
      expect(driver?.phone).toBe('+260960500656');
      expect(driver?.role).toBe('driver');
    });

    it('should return null for non-existent driver', () => {
      const driver = service.getDriver(999);
      expect(driver).toBeNull();
    });

    it('should retrieve driver vehicle', () => {
      const vehicle = service.getDriverVehicle(1);
      expect(vehicle).toBeDefined();
      expect(vehicle?.vehicleType).toBe('Pickup Truck');
      expect(vehicle?.plateNumber).toBe('ZMB 123');
      expect(vehicle?.isActive).toBe(true);
    });

    it('should return null if driver has no active vehicle', () => {
      const vehicle = service.getDriverVehicle(999);
      expect(vehicle).toBeNull();
    });
  });

  // ============ COMPLETED BOOKINGS TESTS ============
  describe('Completed Bookings', () => {
    beforeEach(() => {
      service.acceptBooking(1, 1);
      service.updateBookingStatus(1, 'in-progress');
      service.updateBookingStatus(1, 'completed');
    });

    it('should retrieve completed bookings for driver', () => {
      const completed = service.getCompletedBookings(1);
      expect(completed.length).toBe(1);
      expect(completed[0].status).toBe('completed');
    });

    it('should not include incomplete bookings', () => {
      service.acceptBooking(2, 1);
      const completed = service.getCompletedBookings(1);
      expect(completed.length).toBe(1);
    });
  });

  // ============ INTEGRATION TESTS ============
  describe('Integration Tests', () => {
    it('should handle complete driver workflow', () => {
      // 1. Get available bookings
      let available = service.getAvailableBookings();
      expect(available.length).toBe(2);

      // 2. Accept first booking
      const accepted = service.acceptBooking(1, 1);
      expect(accepted).toBe(true);

      // 3. Check available bookings updated
      available = service.getAvailableBookings();
      expect(available.length).toBe(1);

      // 4. Get driver bookings
      let driverBookings = service.getDriverBookings(1);
      expect(driverBookings.length).toBe(1);

      // 5. Start pickup
      service.updateBookingStatus(1, 'in-progress');
      const booking = service.getBookingById(1);
      expect(booking?.status).toBe('in-progress');

      // 6. Complete delivery
      service.updateBookingStatus(1, 'completed');
      expect(booking?.status).toBe('completed');
      expect(booking?.completedAt).toBeDefined();

      // 7. Get completed bookings
      const completed = service.getCompletedBookings(1);
      expect(completed.length).toBe(1);
      expect(completed[0].id).toBe(1);
    });

    it('should handle multiple drivers', () => {
      // Driver 1 accepts booking 1
      service.acceptBooking(1, 1);

      // Driver 2 accepts booking 2
      service.acceptBooking(2, 2);

      // Check each driver has their booking
      const driver1Bookings = service.getDriverBookings(1);
      const driver2Bookings = service.getDriverBookings(2);

      expect(driver1Bookings.length).toBe(1);
      expect(driver2Bookings.length).toBe(1);
      expect(driver1Bookings[0].id).toBe(1);
      expect(driver2Bookings[0].id).toBe(2);
    });

    it('should handle booking rejection and re-acceptance', () => {
      // Reject booking
      service.rejectBooking(1);
      let available = service.getAvailableBookings();
      // Rejected bookings should not appear in available list
      expect(available.find((b) => b.id === 1)).toBeUndefined();
      // But the booking itself should have rejected status
      const booking = service.getBookingById(1);
      expect(booking?.status).toBe('rejected');

      // Create new booking
      const newBooking = service.createBooking({
        customerId: 102,
        driverId: null,
        customerName: 'New Customer',
        customerPhone: '+260960500658',
        pickupLocation: 'Lusaka',
        dropoffLocation: 'Livingstone',
        cargoType: 'Cargo',
        cargoWeight: '100kg',
        estimatedPrice: 300,
        status: 'pending',
        vehicleRequired: 'Van',
        scheduledTime: null,
        completedAt: null,
        notes: null,
      });

      // Accept new booking
      service.acceptBooking(newBooking.id, 1);
      const driverBookings = service.getDriverBookings(1);
      expect(driverBookings.find((b) => b.id === newBooking.id)).toBeDefined();
    });
  });
});
