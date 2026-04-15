/**
 * Carrier Booking System Types and Models
 */

export type VehicleType = 'motorbike' | 'small-van' | 'pickup-truck' | 'box-truck' | 'trailer';

export type CargoType = 'luggage' | 'furniture' | 'electronics' | 'food' | 'building-materials' | 'other';

export type CustomerType = 'individual' | 'business';

export type BookingStatus = 'pending' | 'searching' | 'accepted' | 'on-the-way' | 'delivered' | 'cancelled';

export type PaymentMethod = 'mobile-money' | 'card' | 'cash-on-delivery';

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  placeId?: string;
}

export interface CargoDetails {
  type: CargoType;
  description: string;
  estimatedWeight: number; // kg
  numberOfItems: number;
  photos?: string[]; // URLs to uploaded photos
}

export interface CustomerInfo {
  type: CustomerType;
  name: string;
  phone: string;
  email: string;
  companyName?: string;
  contactPerson?: string;
  businessPhone?: string;
  businessEmail?: string;
}

export interface ScheduleInfo {
  pickupDate: string; // ISO date
  pickupTime: string; // HH:mm format
  immediate: boolean;
}

export interface PricingBreakdown {
  baseFare: number;
  distanceFare: number;
  vehicleMultiplier: number;
  surgeMultiplier: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface DriverInfo {
  id: string;
  name: string;
  photo: string;
  phone: string;
  rating: number;
  totalDeliveries: number;
  vehicleType: VehicleType;
  vehiclePlate: string;
  vehiclePhoto: string;
}

export interface BookingRequest {
  id?: string;
  customerId: string;
  customerInfo: CustomerInfo;
  vehicleType: VehicleType;
  pickupLocation: Location;
  dropoffLocation: Location;
  cargo: CargoDetails;
  schedule: ScheduleInfo;
  paymentMethod: PaymentMethod;
  estimatedDistance: number; // km
  estimatedDuration: number; // minutes
  pricing: PricingBreakdown;
  status: BookingStatus;
  driverId?: string;
  driver?: DriverInfo;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  rating?: number;
  review?: string;
}

export interface BookingHistory {
  bookings: BookingRequest[];
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  averageRating: number;
}

export interface VehicleTypeInfo {
  id: VehicleType;
  name: string;
  icon: string;
  capacity: string;
  baseFare: number;
  pricePerKm: number;
  maxWeight: number; // kg
  description: string;
}

export interface PricingConfig {
  vehicles: Record<VehicleType, VehicleTypeInfo>;
  baseFare: number;
  pricePerKm: number;
  surgeMultiplier: number;
  taxRate: number;
  minimumFare: number;
}

export interface DriverMatch {
  driver: DriverInfo;
  distance: number; // km
  estimatedArrival: number; // minutes
  acceptanceProbability: number; // 0-1
}

export interface BookingNotification {
  id: string;
  bookingId: string;
  type: 'status-update' | 'driver-assigned' | 'driver-arrived' | 'delivery-completed' | 'rating-request';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface InAppMessage {
  id: string;
  bookingId: string;
  senderId: string;
  senderType: 'customer' | 'driver';
  message: string;
  timestamp: string;
  read: boolean;
  attachments?: string[];
}

export interface BookingStats {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  totalSpent: number;
  averageRating: number;
  favoriteVehicleType: VehicleType;
  frequentLocations: Location[];
}
