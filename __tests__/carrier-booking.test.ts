/**
 * Comprehensive tests for Book a Carrier feature
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CarrierBookingService } from '../lib/carrier-booking-service';
import type {
  BookingRequest,
  VehicleType,
  CargoType,
  CustomerType,
  PaymentMethod,
} from '../lib/carrier-booking-types';

describe('Carrier Booking Service', () => {
  let service: CarrierBookingService;

  beforeEach(() => {
    service = new CarrierBookingService();
  });

  describe('Vehicle Types', () => {
    it('should return all vehicle types', () => {
      const vehicles = service.getAllVehicleTypes();
      expect(vehicles.length).toBeGreaterThan(0);
      expect(vehicles.some(v => v.id === 'motorbike')).toBe(true);
      expect(vehicles.some(v => v.id === 'small-van')).toBe(true);
    });

    it('should have valid vehicle type properties', () => {
      const vehicles = service.getAllVehicleTypes();
      vehicles.forEach(vehicle => {
        expect(vehicle.id).toBeDefined();
        expect(vehicle.name).toBeDefined();
        expect(vehicle.capacity).toBeDefined();
        expect(vehicle.baseFare).toBeGreaterThan(0);
      });
    });
  });

  describe('Booking Creation', () => {
    it('should create a booking with all required fields', () => {
      const booking = service.createBooking(
        'user-123',
        {
          type: 'individual',
          name: 'John Doe',
          phone: '+260960123456',
          email: 'john@example.com',
        },
        'small-van',
        { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka City Center', placeId: 'lusaka' },
        { latitude: -10.85, longitude: 34.5, address: 'Kamwala', placeId: 'kamwala' },
        {
          type: 'luggage',
          description: 'Travel bags',
          estimatedWeight: 50,
          numberOfItems: 3,
        },
        {
          pickupDate: '2026-01-25',
          pickupTime: '10:00',
          immediate: false,
        },
        'mobile-money',
      );

      expect(booking.id).toBeDefined();
      expect(booking.customerId).toBe('user-123');
      expect(booking.vehicleType).toBe('small-van');
      expect(booking.status).toBe('pending');
      expect(booking.pricing.total).toBeGreaterThan(0);
    });

    it('should calculate pricing correctly', () => {
      const booking = service.createBooking(
        'user-123',
        {
          type: 'individual',
          name: 'John Doe',
          phone: '+260960123456',
          email: 'john@example.com',
        },
        'pickup-truck',
        { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka City Center', placeId: 'lusaka' },
        { latitude: -10.85, longitude: 34.5, address: 'Kamwala', placeId: 'kamwala' },
        {
          type: 'furniture',
          description: 'Sofa and chairs',
          estimatedWeight: 200,
          numberOfItems: 5,
        },
        {
          pickupDate: '2026-01-25',
          pickupTime: '10:00',
          immediate: false,
        },
        'card',
      );

      expect(booking.pricing.baseFare).toBeGreaterThan(0);
      expect(booking.pricing.distanceFare).toBeGreaterThan(0);
      expect(booking.pricing.subtotal).toBeGreaterThan(0);
      expect(booking.pricing.tax).toBeGreaterThan(0);
      expect(booking.pricing.total).toBeGreaterThan(booking.pricing.subtotal);
    });

    it('should handle business customer type', () => {
      const booking = service.createBooking(
        'user-456',
        {
          type: 'business',
          name: 'Jane Smith',
          phone: '+260960654321',
          email: 'jane@company.com',
          companyName: 'ABC Logistics',
        },
        'box-truck',
        { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka City Center', placeId: 'lusaka' },
        { latitude: -10.85, longitude: 34.5, address: 'Kamwala', placeId: 'kamwala' },
        {
          type: 'building-materials',
          description: 'Cement and bricks',
          estimatedWeight: 500,
          numberOfItems: 20,
        },
        {
          pickupDate: '2026-01-25',
          pickupTime: '14:00',
          immediate: false,
        },
        'cash-on-delivery',
      );

      expect(booking.customerInfo.type).toBe('business');
      expect(booking.customerInfo.companyName).toBe('ABC Logistics');
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance between two locations', () => {
      const loc1 = { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka', placeId: 'lusaka' };
      const loc2 = { latitude: -10.85, longitude: 34.5, address: 'Kamwala', placeId: 'kamwala' };

      const distance = service.calculateDistance(loc1, loc2);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(100); // Should be reasonable distance
    });

    it('should return 0 for same location', () => {
      const loc = { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka', placeId: 'lusaka' };
      const distance = service.calculateDistance(loc, loc);
      expect(distance).toBe(0);
    });
  });

  describe('Booking Retrieval', () => {
    it('should retrieve booking by ID', () => {
      const booking = service.createBooking(
        'user-123',
        {
          type: 'individual',
          name: 'John Doe',
          phone: '+260960123456',
          email: 'john@example.com',
        },
        'small-van',
        { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka City Center', placeId: 'lusaka' },
        { latitude: -10.85, longitude: 34.5, address: 'Kamwala', placeId: 'kamwala' },
        {
          type: 'luggage',
          description: 'Travel bags',
          estimatedWeight: 50,
          numberOfItems: 3,
        },
        {
          pickupDate: '2026-01-25',
          pickupTime: '10:00',
          immediate: false,
        },
        'mobile-money',
      );

      const retrieved = service.getBooking(booking.id || '');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(booking.id);
      expect(retrieved?.customerId).toBe('user-123');
    });

    it('should return undefined for non-existent booking', () => {
      const booking = service.getBooking('non-existent-id');
      expect(booking).toBeUndefined();
    });
  });

  describe('Driver Matching', () => {
    it('should find available drivers', () => {
      const drivers = service.findAvailableDrivers(
        'small-van',
        { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka City Center', placeId: 'lusaka' },
      );

      expect(Array.isArray(drivers)).toBe(true);
      expect(drivers.length).toBeGreaterThan(0);
    });

    it('should return drivers with valid properties', () => {
      const drivers = service.findAvailableDrivers(
        'pickup-truck',
        { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka City Center', placeId: 'lusaka' },
      );

      drivers.forEach(match => {
        expect(match.driver.id).toBeDefined();
        expect(match.driver.name).toBeDefined();
        expect(match.driver.rating).toBeGreaterThanOrEqual(0);
        expect(match.distance).toBeGreaterThanOrEqual(0);
        expect(match.estimatedArrival).toBeGreaterThan(0);
      });
    });
  });

  describe('Driver Assignment', () => {
    it('should assign driver to booking', () => {
      const booking = service.createBooking(
        'user-123',
        {
          type: 'individual',
          name: 'John Doe',
          phone: '+260960123456',
          email: 'john@example.com',
        },
        'small-van',
        { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka City Center', placeId: 'lusaka' },
        { latitude: -10.85, longitude: 34.5, address: 'Kamwala', placeId: 'kamwala' },
        {
          type: 'luggage',
          description: 'Travel bags',
          estimatedWeight: 50,
          numberOfItems: 3,
        },
        {
          pickupDate: '2026-01-25',
          pickupTime: '10:00',
          immediate: false,
        },
        'mobile-money',
      );

      const drivers = service.findAvailableDrivers(
        'small-van',
        booking.pickupLocation,
      );

      if (drivers.length > 0) {
        const updated = service.assignDriver(booking.id || '', drivers[0].driver.id);
        expect(updated?.status).toBe('accepted');
        expect(updated?.driver).toBeDefined();
      }
    });
  });

  describe('Booking Status Updates', () => {
    it('should update booking status', () => {
      const booking = service.createBooking(
        'user-123',
        {
          type: 'individual',
          name: 'John Doe',
          phone: '+260960123456',
          email: 'john@example.com',
        },
        'small-van',
        { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka City Center', placeId: 'lusaka' },
        { latitude: -10.85, longitude: 34.5, address: 'Kamwala', placeId: 'kamwala' },
        {
          type: 'luggage',
          description: 'Travel bags',
          estimatedWeight: 50,
          numberOfItems: 3,
        },
        {
          pickupDate: '2026-01-25',
          pickupTime: '10:00',
          immediate: false,
        },
        'mobile-money',
      );

      const updated = service.updateBookingStatus(booking.id || '', 'on-the-way');
      expect(updated?.status).toBe('on-the-way');
    });
  });

  describe('Cargo Types', () => {
    it('should support all cargo types', () => {
      const cargoTypes: CargoType[] = [
        'luggage',
        'furniture',
        'electronics',
        'food',
        'building-materials',
        'other',
      ];

      cargoTypes.forEach(type => {
        const booking = service.createBooking(
          'user-123',
          {
            type: 'individual',
            name: 'John Doe',
            phone: '+260960123456',
            email: 'john@example.com',
          },
          'small-van',
          { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka City Center', placeId: 'lusaka' },
          { latitude: -10.85, longitude: 34.5, address: 'Kamwala', placeId: 'kamwala' },
          {
            type,
            description: 'Test cargo',
            estimatedWeight: 50,
            numberOfItems: 1,
          },
          {
            pickupDate: '2026-01-25',
            pickupTime: '10:00',
            immediate: false,
          },
          'mobile-money',
        );

        expect(booking.cargo.type).toBe(type);
      expect(booking.pricing.total).toBeGreaterThan(0);
      });
    });
  });

  describe('Payment Methods', () => {
    it('should support all payment methods', () => {
      const paymentMethods: PaymentMethod[] = ['mobile-money', 'card', 'cash-on-delivery'];

      paymentMethods.forEach(method => {
        const booking = service.createBooking(
          'user-123',
          {
            type: 'individual',
            name: 'John Doe',
            phone: '+260960123456',
            email: 'john@example.com',
          },
          'small-van',
          { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka City Center', placeId: 'lusaka' },
          { latitude: -10.85, longitude: 34.5, address: 'Kamwala', placeId: 'kamwala' },
          {
            type: 'luggage',
            description: 'Travel bags',
            estimatedWeight: 50,
            numberOfItems: 3,
          },
          {
            pickupDate: '2026-01-25',
            pickupTime: '10:00',
            immediate: false,
          },
          method,
        );

        expect(booking.paymentMethod).toBe(method);
      });
    });
  });

  describe('Immediate Pickup', () => {
    it('should handle immediate pickup requests', () => {
      const booking = service.createBooking(
        'user-123',
        {
          type: 'individual',
          name: 'John Doe',
          phone: '+260960123456',
          email: 'john@example.com',
        },
        'small-van',
        { latitude: -10.8335, longitude: 34.5085, address: 'Lusaka City Center', placeId: 'lusaka' },
        { latitude: -10.85, longitude: 34.5, address: 'Kamwala', placeId: 'kamwala' },
        {
          type: 'luggage',
          description: 'Travel bags',
          estimatedWeight: 50,
          numberOfItems: 3,
        },
        {
          pickupDate: '',
          pickupTime: '',
          immediate: true,
        },
        'mobile-money',
      );

      expect(booking.schedule.immediate).toBe(true);
    });
  });
});
