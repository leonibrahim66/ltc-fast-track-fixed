/**
 * Carrier Booking Service
 * Handles booking creation, management, pricing, and driver matching
 */

import type {
  BookingRequest,
  BookingStatus,
  CargoDetails,
  CustomerInfo,
  DriverInfo,
  DriverMatch,
  Location,
  PaymentMethod,
  PricingBreakdown,
  PricingConfig,
  ScheduleInfo,
  VehicleType,
  VehicleTypeInfo,
} from './carrier-booking-types';

export class CarrierBookingService {
  private bookings: Map<string, BookingRequest> = new Map();
  private drivers: Map<string, DriverInfo> = new Map();
  private pricingConfig!: PricingConfig;

  constructor() {
    this.initializePricingConfig();
    this.initializeMockDrivers();
  }

  private initializePricingConfig(): void {
    this.pricingConfig = {
      baseFare: 5,
      pricePerKm: 2,
      surgeMultiplier: 1,
      taxRate: 0.1,
      minimumFare: 10,
      vehicles: {
        'motorbike': {
          id: 'motorbike',
          name: 'Motorbike',
          icon: '🏍️',
          capacity: 'Small packages',
          baseFare: 5,
          pricePerKm: 1.5,
          maxWeight: 20,
          description: 'Fast delivery for small items',
        },
        'small-van': {
          id: 'small-van',
          name: 'Small Van',
          icon: '🚐',
          capacity: 'Up to 500kg',
          baseFare: 10,
          pricePerKm: 2.5,
          maxWeight: 500,
          description: 'Ideal for household items',
        },
        'pickup-truck': {
          id: 'pickup-truck',
          name: 'Pickup Truck',
          icon: '🚙',
          capacity: 'Up to 1 ton',
          baseFare: 15,
          pricePerKm: 3,
          maxWeight: 1000,
          description: 'Perfect for furniture and appliances',
        },
        'box-truck': {
          id: 'box-truck',
          name: 'Box Truck',
          icon: '🚚',
          capacity: 'Up to 3 tons',
          baseFare: 25,
          pricePerKm: 4,
          maxWeight: 3000,
          description: 'Large cargo and commercial goods',
        },
        'trailer': {
          id: 'trailer',
          name: 'Trailer/Heavy Truck',
          icon: '🚛',
          capacity: 'Up to 10 tons',
          baseFare: 50,
          pricePerKm: 6,
          maxWeight: 10000,
          description: 'Heavy equipment and bulk items',
        },
      },
    };
  }

  private initializeMockDrivers(): void {
    const mockDrivers: DriverInfo[] = [
      {
        id: 'driver-1',
        name: 'John Banda',
        phone: '+260960123456',
        photo: 'https://via.placeholder.com/100',
        rating: 4.8,
        totalDeliveries: 250,
        vehicleType: 'small-van',
        vehiclePlate: 'ZM-2024-001',
        vehiclePhoto: 'https://via.placeholder.com/200',
      },
      {
        id: 'driver-2',
        name: 'Grace Mwale',
        phone: '+260960234567',
        photo: 'https://via.placeholder.com/100',
        rating: 4.9,
        totalDeliveries: 180,
        vehicleType: 'pickup-truck',
        vehiclePlate: 'ZM-2024-002',
        vehiclePhoto: 'https://via.placeholder.com/200',
      },
      {
        id: 'driver-3',
        name: 'Kaunda Phiri',
        phone: '+260960345678',
        photo: 'https://via.placeholder.com/100',
        rating: 4.7,
        totalDeliveries: 320,
        vehicleType: 'box-truck',
        vehiclePlate: 'ZM-2024-003',
        vehiclePhoto: 'https://via.placeholder.com/200',
      },
    ];

    mockDrivers.forEach(driver => this.drivers.set(driver.id, driver));
  }

  /**
   * Calculate distance between two locations using Haversine formula
   */
  calculateDistance(loc1: Location, loc2: Location): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((loc1.latitude * Math.PI) / 180) *
        Math.cos((loc2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate pricing based on distance and vehicle type
   */
  calculatePricing(
    distance: number,
    vehicleType: VehicleType,
    weight: number,
  ): PricingBreakdown {
    const vehicle = this.pricingConfig.vehicles[vehicleType];
    const baseFare = vehicle.baseFare;
    const distanceFare = distance * vehicle.pricePerKm;
    const vehicleMultiplier = vehicle.baseFare / this.pricingConfig.baseFare;
    const surgeMultiplier = this.pricingConfig.surgeMultiplier;

    const subtotal = Math.max(
      this.pricingConfig.minimumFare,
      (baseFare + distanceFare) * vehicleMultiplier * surgeMultiplier,
    );
    const tax = subtotal * this.pricingConfig.taxRate;
    const total = subtotal + tax;

    return {
      baseFare,
      distanceFare,
      vehicleMultiplier,
      surgeMultiplier,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Estimate delivery time based on distance
   */
  estimateDeliveryTime(distance: number): number {
    // Assume average speed of 40 km/h in urban areas
    return Math.ceil((distance / 40) * 60);
  }

  /**
   * Create a new booking
   */
  createBooking(
    customerId: string,
    customerInfo: CustomerInfo,
    vehicleType: VehicleType,
    pickupLocation: Location,
    dropoffLocation: Location,
    cargo: CargoDetails,
    schedule: ScheduleInfo,
    paymentMethod: PaymentMethod,
  ): BookingRequest {
    const distance = this.calculateDistance(pickupLocation, dropoffLocation);
    const duration = this.estimateDeliveryTime(distance);
    const pricing = this.calculatePricing(distance, vehicleType, cargo.estimatedWeight);

    const bookingId = `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const booking: BookingRequest = {
      id: bookingId,
      customerId,
      customerInfo,
      vehicleType,
      pickupLocation,
      dropoffLocation,
      cargo,
      schedule,
      paymentMethod,
      estimatedDistance: Math.round(distance * 100) / 100,
      estimatedDuration: duration,
      pricing,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.bookings.set(bookingId, booking);
    return booking;
  }

  /**
   * Get booking by ID
   */
  getBooking(bookingId: string): BookingRequest | undefined {
    return this.bookings.get(bookingId);
  }

  /**
   * Get all bookings for a customer
   */
  getCustomerBookings(customerId: string): BookingRequest[] {
    return Array.from(this.bookings.values()).filter(
      booking => booking.customerId === customerId,
    );
  }

  /**
   * Update booking status
   */
  updateBookingStatus(bookingId: string, status: BookingStatus): BookingRequest | undefined {
    const booking = this.bookings.get(bookingId);
    if (booking) {
      booking.status = status;
      booking.updatedAt = new Date().toISOString();
      if (status === 'delivered') {
        booking.completedAt = new Date().toISOString();
      }
      this.bookings.set(bookingId, booking);
    }
    return booking;
  }

  /**
   * Assign driver to booking
   */
  assignDriver(bookingId: string, driverId: string): BookingRequest | undefined {
    const booking = this.bookings.get(bookingId);
    const driver = this.drivers.get(driverId);

    if (booking && driver) {
      booking.driverId = driverId;
      booking.driver = driver;
      booking.status = 'accepted';
      booking.updatedAt = new Date().toISOString();
      this.bookings.set(bookingId, booking);
    }

    return booking;
  }

  /**
   * Find available drivers for a booking
   */
  findAvailableDrivers(
    vehicleType: VehicleType,
    pickupLocation: Location,
  ): DriverMatch[] {
    const matches: DriverMatch[] = [];

    this.drivers.forEach(driver => {
      if (driver.vehicleType === vehicleType) {
        // Simulate distance from driver to pickup location
        const distance = Math.random() * 15; // 0-15 km
        const estimatedArrival = Math.ceil((distance / 40) * 60); // minutes

        matches.push({
          driver,
          distance: Math.round(distance * 100) / 100,
          estimatedArrival,
          acceptanceProbability: 0.8 + Math.random() * 0.2, // 80-100%
        });
      }
    });

    // Sort by estimated arrival time
    return matches.sort((a, b) => a.estimatedArrival - b.estimatedArrival);
  }

  /**
   * Add rating and review to completed booking
   */
  rateBooking(
    bookingId: string,
    rating: number,
    review?: string,
  ): BookingRequest | undefined {
    const booking = this.bookings.get(bookingId);
    if (booking && booking.status === 'delivered') {
      booking.rating = Math.max(1, Math.min(5, rating));
      booking.review = review;
      booking.updatedAt = new Date().toISOString();
      this.bookings.set(bookingId, booking);
    }
    return booking;
  }

  /**
   * Cancel booking
   */
  cancelBooking(bookingId: string): BookingRequest | undefined {
    const booking = this.bookings.get(bookingId);
    if (booking && !['delivered', 'cancelled'].includes(booking.status)) {
      booking.status = 'cancelled';
      booking.updatedAt = new Date().toISOString();
      this.bookings.set(bookingId, booking);
    }
    return booking;
  }

  /**
   * Get vehicle type info
   */
  getVehicleTypeInfo(vehicleType: VehicleType): VehicleTypeInfo {
    return this.pricingConfig.vehicles[vehicleType];
  }

  /**
   * Get all vehicle types
   */
  getAllVehicleTypes(): VehicleTypeInfo[] {
    return Object.values(this.pricingConfig.vehicles);
  }

  /**
   * Get booking statistics for customer
   */
  getBookingStats(customerId: string) {
    const customerBookings = this.getCustomerBookings(customerId);
    const completedBookings = customerBookings.filter(b => b.status === 'delivered');
    const cancelledBookings = customerBookings.filter(b => b.status === 'cancelled');
    const pendingBookings = customerBookings.filter(
      b => !['delivered', 'cancelled'].includes(b.status),
    );

    const totalSpent = completedBookings.reduce((sum, b) => sum + b.pricing.total, 0);
    const averageRating =
      completedBookings.filter(b => b.rating).reduce((sum, b) => sum + (b.rating || 0), 0) /
        Math.max(1, completedBookings.filter(b => b.rating).length) || 0;

    return {
      totalBookings: customerBookings.length,
      completedBookings: completedBookings.length,
      cancelledBookings: cancelledBookings.length,
      pendingBookings: pendingBookings.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      averageRating: Math.round(averageRating * 10) / 10,
    };
  }
}

// Export singleton instance
export const carrierBookingService = new CarrierBookingService();
