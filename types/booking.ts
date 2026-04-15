export interface CustomerBooking {
  id: string;
  bookingId: string; // Display ID (e.g., "BK-2024-001")
  customerId: string;
  customerName: string;
  customerPhone: string;
  
  // Location details
  pickupLocation: string;
  dropoffLocation: string;
  distance: string;
  additionalStops?: string[];
  
  // Cargo details
  cargoType: string;
  cargoWeight: string;
  vehicleRequired: string;
  
  // Pricing
  estimatedPrice: number;
  totalAmount: number;
  
  // Status
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
  paymentStatus: "paid" | "pending" | "failed";
  
  // Timestamps
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
  rejectedAt?: string;
  
  // Driver & Vehicle (only if accepted/completed)
  driverName?: string;
  driverPhone?: string;
  vehicleType?: string;
  vehicleColor?: string;
  vehiclePlate?: string;
  
  // Payment history
  payments?: PaymentRecord[];
}

export interface PaymentRecord {
  id: string;
  amount: number;
  method: string; // "MTN Mobile Money", "Airtel Money", "Bank Transfer"
  transactionId: string;
  status: "paid" | "pending" | "failed";
  paidAt?: string;
  createdAt: string;
}

export interface BookingNotification {
  id: string;
  bookingId: string;
  type: "accepted" | "rejected" | "driver_assigned" | "completed" | "cancelled";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
