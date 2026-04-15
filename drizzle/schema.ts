import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "driver", "carrier"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Driver profiles table - stores driver-specific information
 */
export const driverProfiles = mysqlTable("driver_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  vehicleType: mysqlEnum("vehicleType", ["motorbike", "van", "pickup", "truck", "trailer"]).notNull(),
  plateNumber: varchar("plateNumber", { length: 50 }).notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  isApproved: boolean("isApproved").default(false).notNull(),
  isSuspended: boolean("isSuspended").default(false).notNull(),
  averageRating: decimal("averageRating", { precision: 3, scale: 2 }).default("0.00"),
  totalRatings: int("totalRatings").default(0),
  totalCompletedJobs: int("totalCompletedJobs").default(0),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }).default("10.00"),
  approvedAt: timestamp("approvedAt"),
  suspendedAt: timestamp("suspendedAt"),
  suspensionReason: text("suspensionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DriverProfile = typeof driverProfiles.$inferSelect;
export type InsertDriverProfile = typeof driverProfiles.$inferInsert;

/**
 * Driver documents table - stores uploaded documents for verification
 */
export const driverDocuments = mysqlTable("driver_documents", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  documentType: mysqlEnum("documentType", ["drivers_license", "nrc_id", "passport", "vehicle_photo"]).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileName: varchar("fileName", { length: 255 }),
  isVerified: boolean("isVerified").default(false).notNull(),
  verifiedAt: timestamp("verifiedAt"),
  verifiedBy: int("verifiedBy"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DriverDocument = typeof driverDocuments.$inferSelect;
export type InsertDriverDocument = typeof driverDocuments.$inferInsert;

/**
 * Transport jobs table - stores all transport booking requests
 */
export const transportJobs = mysqlTable("transport_jobs", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  driverId: int("driverId"),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  pickupLocation: text("pickupLocation").notNull(),
  pickupLatitude: decimal("pickupLatitude", { precision: 10, scale: 8 }),
  pickupLongitude: decimal("pickupLongitude", { precision: 11, scale: 8 }),
  dropoffLocation: text("dropoffLocation").notNull(),
  dropoffLatitude: decimal("dropoffLatitude", { precision: 10, scale: 8 }),
  dropoffLongitude: decimal("dropoffLongitude", { precision: 11, scale: 8 }),
  distance: decimal("distance", { precision: 10, scale: 2 }),
  cargoType: varchar("cargoType", { length: 255 }),
  cargoDescription: text("cargoDescription"),
  cargoWeight: varchar("cargoWeight", { length: 100 }),
  vehicleRequired: mysqlEnum("vehicleRequired", ["motorbike", "van", "pickup", "truck", "trailer"]),
  estimatedPrice: decimal("estimatedPrice", { precision: 10, scale: 2 }),
  finalPrice: decimal("finalPrice", { precision: 10, scale: 2 }),
  commissionAmount: decimal("commissionAmount", { precision: 10, scale: 2 }),
  driverEarnings: decimal("driverEarnings", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["pending", "accepted", "arrived", "picked_up", "in_transit", "delivered", "completed", "cancelled", "rejected"]).default("pending").notNull(),
  scheduledTime: timestamp("scheduledTime"),
  acceptedAt: timestamp("acceptedAt"),
  arrivedAt: timestamp("arrivedAt"),
  pickedUpAt: timestamp("pickedUpAt"),
  deliveredAt: timestamp("deliveredAt"),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
  cancellationReason: text("cancellationReason"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TransportJob = typeof transportJobs.$inferSelect;
export type InsertTransportJob = typeof transportJobs.$inferInsert;

/**
 * Driver wallet table - tracks driver earnings and balance
 */
export const driverWallets = mysqlTable("driver_wallets", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull().unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalEarnings: decimal("totalEarnings", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalWithdrawn: decimal("totalWithdrawn", { precision: 12, scale: 2 }).default("0.00").notNull(),
  pendingWithdrawal: decimal("pendingWithdrawal", { precision: 12, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DriverWallet = typeof driverWallets.$inferSelect;
export type InsertDriverWallet = typeof driverWallets.$inferInsert;

/**
 * Wallet transactions table - tracks all wallet movements
 */
export const walletTransactions = mysqlTable("wallet_transactions", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  jobId: int("jobId"),
  type: mysqlEnum("type", ["earning", "withdrawal", "bonus", "deduction", "refund"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  reference: varchar("reference", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;

/**
 * Driver withdrawals table - tracks withdrawal requests
 */
export const driverWithdrawals = mysqlTable("driver_withdrawals", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  withdrawalMethod: mysqlEnum("withdrawalMethod", ["mobile_money", "bank_transfer"]).notNull(),
  accountNumber: varchar("accountNumber", { length: 100 }).notNull(),
  accountName: varchar("accountName", { length: 255 }),
  bankName: varchar("bankName", { length: 255 }),
  mobileProvider: varchar("mobileProvider", { length: 100 }),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed", "cancelled"]).default("pending").notNull(),
  processedAt: timestamp("processedAt"),
  processedBy: int("processedBy"),
  failureReason: text("failureReason"),
  transactionReference: varchar("transactionReference", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DriverWithdrawal = typeof driverWithdrawals.$inferSelect;
export type InsertDriverWithdrawal = typeof driverWithdrawals.$inferInsert;

/**
 * Driver ratings table - stores customer ratings for drivers
 */
export const driverRatings = mysqlTable("driver_ratings", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  customerId: int("customerId").notNull(),
  jobId: int("jobId").notNull(),
  rating: int("rating").notNull(),
  review: text("review"),
  isPublic: boolean("isPublic").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DriverRating = typeof driverRatings.$inferSelect;
export type InsertDriverRating = typeof driverRatings.$inferInsert;

/**
 * Driver activity log - tracks driver actions for admin monitoring
 */
export const driverActivityLog = mysqlTable("driver_activity_log", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  activityType: mysqlEnum("activityType", ["online", "offline", "job_accepted", "job_rejected", "job_completed", "job_cancelled", "withdrawal_requested", "profile_updated", "document_uploaded"]).notNull(),
  jobId: int("jobId"),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DriverActivityLog = typeof driverActivityLog.$inferSelect;
export type InsertDriverActivityLog = typeof driverActivityLog.$inferInsert;

/**
 * Admin settings table - stores system configuration
 */
export const adminSettings = mysqlTable("admin_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  description: text("description"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminSetting = typeof adminSettings.$inferSelect;
export type InsertAdminSetting = typeof adminSettings.$inferInsert;

/**
 * Disputes table - tracks customer/driver disputes
 */
export const disputes = mysqlTable("disputes", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(),
  reportedBy: int("reportedBy").notNull(),
  reportedAgainst: int("reportedAgainst").notNull(),
  reporterType: mysqlEnum("reporterType", ["customer", "driver"]).notNull(),
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["open", "investigating", "resolved", "closed"]).default("open").notNull(),
  resolution: text("resolution"),
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Dispute = typeof disputes.$inferSelect;
export type InsertDispute = typeof disputes.$inferInsert;

// Legacy tables for backward compatibility
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  driverId: int("driverId"),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  pickupLocation: text("pickupLocation").notNull(),
  dropoffLocation: text("dropoffLocation").notNull(),
  cargoType: varchar("cargoType", { length: 255 }),
  cargoWeight: varchar("cargoWeight", { length: 100 }),
  estimatedPrice: decimal("estimatedPrice", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["pending", "accepted", "in-progress", "completed", "rejected", "cancelled"]).default("pending").notNull(),
  vehicleRequired: varchar("vehicleRequired", { length: 255 }),
  scheduledTime: timestamp("scheduledTime"),
  completedAt: timestamp("completedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

export const vehicles = mysqlTable("vehicles", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  vehicleType: varchar("vehicleType", { length: 255 }).notNull(),
  plateNumber: varchar("plateNumber", { length: 50 }).notNull(),
  capacity: varchar("capacity", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

/**
 * Zones table - stores garbage collection zones
 */
export const zones = mysqlTable("zones", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  description: text("description"),
  boundaries: text("boundaries"), // JSON string of coordinates
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  householdCount: int("householdCount").default(0).notNull(),
  collectorCount: int("collectorCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Zone = typeof zones.$inferSelect;
export type InsertZone = typeof zones.$inferInsert;

/**
 * Zone collectors junction table - many-to-many relationship between zones and collectors
 */
export const zoneCollectors = mysqlTable("zone_collectors", {
  id: int("id").autoincrement().primaryKey(),
  zoneId: int("zoneId").notNull(),
  collectorId: int("collectorId").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type ZoneCollector = typeof zoneCollectors.$inferSelect;
export type InsertZoneCollector = typeof zoneCollectors.$inferInsert;

/**
 * Customer wallet balances table
 */
export const customerWallets = mysqlTable("customer_wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  totalBalance: decimal("totalBalance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  rechargedBalance: decimal("rechargedBalance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  referralBalance: decimal("referralBalance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerWallet = typeof customerWallets.$inferSelect;
export type InsertCustomerWallet = typeof customerWallets.$inferInsert;

/**
 * Customer wallet transactions table - tracks customer wallet movements
 */
export const customerWalletTransactions = mysqlTable("customer_wallet_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["recharge", "withdrawal", "referral", "payment"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["completed", "pending", "failed"]).default("pending").notNull(),
  description: text("description"),
  referenceId: varchar("referenceId", { length: 255 }), // Payment gateway reference or transaction ID
  bankDetails: text("bankDetails"), // For withdrawals
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerWalletTransaction = typeof customerWalletTransactions.$inferSelect;
export type InsertCustomerWalletTransaction = typeof customerWalletTransactions.$inferInsert;

/**
 * Customer linked accounts table - for withdrawal phone numbers and PINs
 */
export const customerLinkedAccounts = mysqlTable("customer_linked_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["mtn_momo", "airtel_money", "zamtel_money"]).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  withdrawalPin: varchar("withdrawalPin", { length: 255 }).notNull(), // Hashed PIN
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerLinkedAccount = typeof customerLinkedAccounts.$inferSelect;
export type InsertCustomerLinkedAccount = typeof customerLinkedAccounts.$inferInsert;

/**
 * Payment transactions table
 * Central ledger for all customer payments with automatic 10% platform commission.
 * All commission calculations are performed on the backend only.
 *
 * Flow: Customer pays → Platform Wallet → 10% commission deducted → 90% credited to provider
 *
 * Providers:
 *   - zone_manager  → garbage collection services
 *   - carrier_driver → logistics / carrier bookings
 */
export const paymentTransactions = mysqlTable("payment_transactions", {
  id: int("id").autoincrement().primaryKey(),

  // Payer (customer)
  payerId: int("payerId").notNull(),

  // Provider receiving the 90% payout
  providerId: int("providerId").notNull(),
  providerRole: mysqlEnum("providerRole", ["zone_manager", "carrier_driver"]).notNull(),

  // Service type
  serviceType: mysqlEnum("serviceType", ["garbage", "carrier"]).notNull(),

  // Reference to the originating job/booking (nullable for future flexibility)
  serviceReferenceId: int("serviceReferenceId"),

  // Financial breakdown — all calculated on backend, never trusted from frontend
  amountTotal: decimal("amountTotal", { precision: 12, scale: 2 }).notNull(),
  platformCommission: decimal("platformCommission", { precision: 12, scale: 2 }).notNull(), // amountTotal * rate
  providerAmount: decimal("providerAmount", { precision: 12, scale: 2 }).notNull(),          // amountTotal - commission
  // Commission tracking fields (for reporting and auditing)
  commissionAmount: decimal("commissionAmount", { precision: 12, scale: 2 }),    // alias for platformCommission
  platformAmount: decimal("platformAmount", { precision: 12, scale: 2 }),        // amount credited to platform wallet
  transactionSource: mysqlEnum("transactionSource", ["garbage", "carrier", "subscription"]), // originating service
  appliedCommissionRate: decimal("appliedCommissionRate", { precision: 5, scale: 4 }),       // e.g. 0.1000 = 10%

  // Payment gateway fields (populated when MTN MoMo is integrated)
  paymentMethod: mysqlEnum("paymentMethod", ["mtn_momo", "airtel_money", "zamtel_money", "bank_transfer", "manual"]).default("manual").notNull(),
  referenceId: varchar("referenceId", { length: 128 }).unique(),   // External gateway reference
  callbackPayload: text("callbackPayload"),                         // Raw callback JSON from gateway

  // Lifecycle status
  status: mysqlEnum("status", [
    "pending",       // Payment requested, awaiting gateway confirmation
    "processing",    // Gateway processing
    "completed",     // Payment confirmed, provider credited
    "released",      // Provider payout released
    "failed",        // Payment failed
    "refunded",      // Payment refunded to customer
    "cancelled",     // Cancelled before processing
  ]).default("pending").notNull(),

  // Withdrawal tracking
  withdrawalRequestedAt: timestamp("withdrawalRequestedAt"),
  withdrawalCompletedAt: timestamp("withdrawalCompletedAt"),
  withdrawalReference: varchar("withdrawalReference", { length: 128 }),

  // Audit
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;

/**
 * Platform wallet table
 * Tracks the platform's accumulated commission balance.
 */
export const platformWallet = mysqlTable("platform_wallet", {
  id: int("id").autoincrement().primaryKey(),
  totalCommissionEarned: decimal("totalCommissionEarned", { precision: 14, scale: 2 }).default("0.00").notNull(),
  availableBalance: decimal("availableBalance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  totalWithdrawn: decimal("totalWithdrawn", { precision: 14, scale: 2 }).default("0.00").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformWallet = typeof platformWallet.$inferSelect;
export type InsertPlatformWallet = typeof platformWallet.$inferInsert;

/**
 * Provider wallets table
 * Tracks each provider's (zone_manager / carrier_driver) earned balance.
 */
export const providerWallets = mysqlTable("provider_wallets", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("providerId").notNull().unique(),
  providerRole: mysqlEnum("providerRole", ["zone_manager", "carrier_driver"]).notNull(),
  availableBalance: decimal("availableBalance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalEarned: decimal("totalEarned", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalWithdrawn: decimal("totalWithdrawn", { precision: 12, scale: 2 }).default("0.00").notNull(),
  pendingBalance: decimal("pendingBalance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProviderWallet = typeof providerWallets.$inferSelect;
export type InsertProviderWallet = typeof providerWallets.$inferInsert;

/**
 * Withdrawal requests table
 * Tracks provider withdrawal requests through the admin approval workflow.
 */
export const withdrawalRequests = mysqlTable("withdrawal_requests", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("providerId").notNull(),
  providerRole: mysqlEnum("providerRole", ["zone_manager", "carrier_driver"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  withdrawalMethod: mysqlEnum("withdrawalMethod", ["mtn_momo", "airtel_money", "zamtel_money", "bank_transfer"]).notNull(),
  accountNumber: varchar("accountNumber", { length: 64 }).notNull(),
  accountName: varchar("accountName", { length: 255 }),
  status: mysqlEnum("status", [
    "pending",    // Awaiting admin review
    "approved",   // Admin approved, payout queued
    "rejected",   // Admin rejected
    "completed",  // Payout sent successfully
    "failed",     // Payout failed after approval
  ]).default("pending").notNull(),
  // Admin action tracking
  reviewedBy: varchar("reviewedBy", { length: 128 }),   // Admin username
  reviewedAt: timestamp("reviewedAt"),
  adminNotes: text("adminNotes"),
  // MTN reference (populated after payout)
  withdrawalReference: varchar("withdrawalReference", { length: 128 }),
  mtnDisbursementAccepted: boolean("mtnDisbursementAccepted").default(false),
  // Audit
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = typeof withdrawalRequests.$inferInsert;

/**
 * Commission rules table
 * Stores per-service-type platform commission rates.
 * Only superadmin can modify these values.
 */
export const commissionRules = mysqlTable("commission_rules", {
  id: int("id").autoincrement().primaryKey(),
  serviceType: mysqlEnum("serviceType", ["garbage", "carrier", "subscription"]).notNull().unique(),
  rate: decimal("rate", { precision: 5, scale: 4 }).notNull().default("0.1000"), // e.g. 0.1000 = 10%
  isActive: boolean("isActive").default(true).notNull(),
  description: text("description"),
  createdBy: varchar("createdBy", { length: 128 }).notNull().default("system"),
  updatedBy: varchar("updatedBy", { length: 128 }).notNull().default("system"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CommissionRule = typeof commissionRules.$inferSelect;
export type InsertCommissionRule = typeof commissionRules.$inferInsert;

/**
 * Commission audit log table
 * Records every commission rate change for compliance and auditing.
 */
export const commissionAuditLog = mysqlTable("commission_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  serviceType: mysqlEnum("serviceType", ["garbage", "carrier", "subscription"]).notNull(),
  oldRate: decimal("oldRate", { precision: 5, scale: 4 }).notNull(),
  newRate: decimal("newRate", { precision: 5, scale: 4 }).notNull(),
  changedBy: varchar("changedBy", { length: 128 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CommissionAuditLog = typeof commissionAuditLog.$inferSelect;
export type InsertCommissionAuditLog = typeof commissionAuditLog.$inferInsert;

/**
 * Driver status table — live GPS tracking for garbage collection drivers.
 *
 * Updated every 15–30 seconds while the driver is active.
 * Used by Zone Managers, Council Admins, and customer arrival alerts.
 *
 * Fields:
 *   driverId   — matches the local AsyncStorage user.id (string)
 *   zoneId     — driver's assigned zone
 *   latitude   — current latitude (decimal 10,8)
 *   longitude  — current longitude (decimal 11,8)
 *   isOnline   — true when driver is active / on route
 *   lastUpdated — ISO timestamp of last location update
 */
export const driverStatus = mysqlTable("driver_status", {
  id: int("id").autoincrement().primaryKey(),
  driverId: varchar("driverId", { length: 128 }).notNull().unique(),
  driverName: varchar("driverName", { length: 255 }),
  zoneId: varchar("zoneId", { length: 128 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  activePickupId: varchar("activePickupId", { length: 128 }),
  headingDegrees: decimal("headingDegrees", { precision: 6, scale: 2 }),
  speedKmh: decimal("speedKmh", { precision: 6, scale: 2 }),
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DriverStatusRecord = typeof driverStatus.$inferSelect;
export type InsertDriverStatusRecord = typeof driverStatus.$inferInsert;

/**
 * User notifications table — stores all in-app notifications for customers.
 *
 * Notification types:
 *   pickup_update       — pickup request status changed
 *   driver_accepted     — a driver accepted the customer's pickup
 *   driver_arriving     — driver is on the way / near
 *   pickup_completed    — pickup has been completed
 *   payment             — payment confirmed or failed
 *   subscription        — subscription activated, renewed, or expired
 *   system              — system-wide announcements
 *   support             — message from support team
 */
export const userNotifications = mysqlTable("user_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 128 }).notNull(),
  type: mysqlEnum("type", [
    "pickup_update",
    "driver_accepted",
    "driver_arriving",
    "pickup_completed",
    "payment",
    "subscription",
    "system",
    "support",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  data: text("data"),
  pickupId: varchar("pickupId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserNotification = typeof userNotifications.$inferSelect;
export type InsertUserNotification = typeof userNotifications.$inferInsert;

/**
 * Zone managers table — stores zone manager profiles and assignments.
 *
 * Fields:
 *   userId      — reference to users table (zone manager user)
 *   zoneId      — reference to zones table (assigned zone)
 *   status      — active/inactive
 *   commissionRate — percentage commission for this zone manager
 *   assignedAt  — when zone manager was assigned to zone
 */
export const zoneManagers = mysqlTable("zone_managers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  zoneId: int("zoneId").notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }).default("10.00").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  unassignedAt: timestamp("unassignedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ZoneManager = typeof zoneManagers.$inferSelect;
export type InsertZoneManager = typeof zoneManagers.$inferInsert;

/**
 * Zone manager drivers table — many-to-many relationship between zone managers and drivers.
 *
 * Fields:
 *   zoneManagerId — reference to zone_managers table
 *   driverId      — reference to driverProfiles table
 *   status        — active/inactive
 *   assignedAt    — when driver was assigned to zone manager
 */
export const zoneManagerDrivers = mysqlTable("zone_manager_drivers", {
  id: int("id").autoincrement().primaryKey(),
  zoneManagerId: int("zoneManagerId").notNull(),
  driverId: int("driverId").notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  unassignedAt: timestamp("unassignedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ZoneManagerDriver = typeof zoneManagerDrivers.$inferSelect;
export type InsertZoneManagerDriver = typeof zoneManagerDrivers.$inferInsert;

/**
 * Customer zone assignments table — auto-assigns customers to zones based on address/location.
 *
 * Fields:
 *   userId      — reference to users table (customer)
 *   zoneId      — reference to zones table (assigned zone)
 *   address     — customer's address
 *   latitude    — customer's latitude
 *   longitude   — customer's longitude
 *   assignedAt  — when customer was assigned to zone
 */
export const customerZoneAssignments = mysqlTable("customer_zone_assignments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  zoneId: int("zoneId").notNull(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerZoneAssignment = typeof customerZoneAssignments.$inferSelect;
export type InsertCustomerZoneAssignment = typeof customerZoneAssignments.$inferInsert;

/**
 * Garbage pickups table — stores garbage collection pickup requests.
 *
 * Fields:
 *   customerId    — reference to users table (customer requesting pickup)
 *   zoneId        — reference to zones table (zone where pickup occurs)
 *   zoneManagerId — reference to zone_managers table (zone manager managing this pickup)
 *   driverId      — reference to driverProfiles table (assigned driver)
 *   address       — pickup location address
 *   latitude      — pickup location latitude
 *   longitude     — pickup location longitude
 *   status        — pending/accepted/assigned/arrived/completed/cancelled
 *   notes         — additional notes
 *   scheduledTime — when pickup was scheduled
 *   acceptedAt    — when driver accepted pickup
 *   assignedAt    — when driver was assigned (manual or auto)
 *   arrivedAt     — when driver arrived
 *   completedAt   — when pickup was completed
 *   cancelledAt   — when pickup was cancelled
 */
export const garbagePickups = mysqlTable("garbage_pickups", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  zoneId: int("zoneId").notNull(),
  zoneManagerId: int("zoneManagerId"),
  driverId: int("driverId"),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "assigned", "arrived", "completed", "cancelled"]).default("pending").notNull(),
  notes: text("notes"),
  scheduledTime: timestamp("scheduledTime"),
  acceptedAt: timestamp("acceptedAt"),
  assignedAt: timestamp("assignedAt"),
  arrivedAt: timestamp("arrivedAt"),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
  cancellationReason: text("cancellationReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GarbagePickup = typeof garbagePickups.$inferSelect;
export type InsertGarbagePickup = typeof garbagePickups.$inferInsert;

/**
 * Pickup assignments table — tracks driver assignments to pickups (manual or auto).
 *
 * Fields:
 *   pickupId   — reference to garbage_pickups table
 *   driverId   — reference to driverProfiles table
 *   assignedBy — reference to zone_managers table (NULL if driver accepted, zoneManagerId if manual)
 *   status     — pending/accepted/assigned/completed/cancelled
 *   acceptedAt — when driver accepted pickup
 *   assignedAt — when driver was assigned (manual)
 *   completedAt — when pickup was completed
 */
export const pickupAssignments = mysqlTable("pickup_assignments", {
  id: int("id").autoincrement().primaryKey(),
  pickupId: int("pickupId").notNull(),
  driverId: int("driverId").notNull(),
  assignedBy: int("assignedBy"), // NULL if driver accepted, zoneManagerId if manual
  status: mysqlEnum("status", ["pending", "accepted", "assigned", "completed", "cancelled"]).default("pending").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  assignedAt: timestamp("assignedAt"),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PickupAssignment = typeof pickupAssignments.$inferSelect;
export type InsertPickupAssignment = typeof pickupAssignments.$inferInsert;


/**
 * Zone geometries table - stores polygon boundaries for zones
 * Supports both manually drawn boundaries and auto-detected boundaries
 * 
 * Fields:
 *   zoneId       — reference to zones table
 *   geometryType — type of geometry (polygon, circle, etc.)
 *   coordinates  — GeoJSON coordinates array
 *   centerLat    — center latitude for circle/point-based zones
 *   centerLng    — center longitude for circle/point-based zones
 *   radius       — radius in meters (for circle-based zones)
 *   createdBy    — userId of zone admin who created/modified
 *   createdAt    — when geometry was created
 */
export const zoneGeometries = mysqlTable("zone_geometries", {
  id: int("id").autoincrement().primaryKey(),
  zoneId: int("zoneId").notNull().unique(),
  geometryType: mysqlEnum("geometryType", ["polygon", "circle", "point"]).default("polygon").notNull(),
  coordinates: text("coordinates").notNull(), // GeoJSON format
  centerLat: decimal("centerLat", { precision: 10, scale: 8 }),
  centerLng: decimal("centerLng", { precision: 11, scale: 8 }),
  radiusMeters: int("radiusMeters"), // For circle-based zones
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ZoneGeometry = typeof zoneGeometries.$inferSelect;
export type InsertZoneGeometry = typeof zoneGeometries.$inferInsert;

/**
 * Zone admin profiles table - stores zone admin-specific information
 * Zone admins can create and manage zones
 * 
 * Fields:
 *   userId       — reference to users table
 *   fullName     — zone admin full name
 *   phone        — contact phone
 *   email        — contact email
 *   isApproved   — whether admin is approved by super admin
 *   approvedAt   — when admin was approved
 *   approvedBy   — userId of super admin who approved
 *   createdAt    — when profile was created
 */
export const zoneAdminProfiles = mysqlTable("zone_admin_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  isApproved: boolean("isApproved").default(false).notNull(),
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ZoneAdminProfile = typeof zoneAdminProfiles.$inferSelect;
export type InsertZoneAdminProfile = typeof zoneAdminProfiles.$inferInsert;

/**
 * Zone admin zones table - tracks which zones each admin manages
 * One admin can manage multiple zones
 * 
 * Fields:
 *   zoneAdminId  — reference to zone_admin_profiles table
 *   zoneId       — reference to zones table
 *   createdBy    — userId of super admin who assigned
 *   assignedAt   — when admin was assigned to zone
 */
export const zoneAdminZones = mysqlTable("zone_admin_zones", {
  id: int("id").autoincrement().primaryKey(),
  zoneAdminId: int("zoneAdminId").notNull(),
  zoneId: int("zoneId").notNull(),
  createdBy: int("createdBy").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type ZoneAdminZone = typeof zoneAdminZones.$inferSelect;
export type InsertZoneAdminZone = typeof zoneAdminZones.$inferInsert;

/**
 * Zone creation audit log - tracks all zone creation and modification events
 * 
 * Fields:
 *   zoneId       — reference to zones table
 *   action       — type of action (created, modified, deleted, boundary_updated)
 *   createdBy    — userId of zone admin who performed action
 *   details      — JSON details of what changed
 *   createdAt    — when action was performed
 */
export const zoneAuditLog = mysqlTable("zone_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  zoneId: int("zoneId").notNull(),
  action: mysqlEnum("action", ["created", "modified", "deleted", "boundary_updated", "name_detected", "auto_assigned_manager"]).notNull(),
  createdBy: int("createdBy").notNull(),
  details: text("details"), // JSON
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ZoneAuditLog = typeof zoneAuditLog.$inferSelect;
export type InsertZoneAuditLog = typeof zoneAuditLog.$inferInsert;
