import { pgTable, pgEnum, integer, varchar, text, timestamp, boolean, numeric, index } from "drizzle-orm/pg-core";

/* ================= ENUMS ================= */
export const roleEnum = pgEnum("role", ["user", "admin", "driver", "carrier"]);
export const vehicleTypeEnum = pgEnum("vehicle_type", ["motorbike", "van", "pickup", "truck", "trailer"]);
export const pickupStatusEnum = pgEnum("pickup_status", [
  "pending",
  "assigned",
  "accepted",
  "in_progress",
  "completed",
  "cancelled"
]);
export const documentTypeEnum = pgEnum("document_type", ["drivers_license", "nrc_id", "passport", "vehicle_photo"]);
export const transportStatusEnum = pgEnum("transport_status", ["pending","accepted","arrived","picked_up","in_transit","delivered","completed","cancelled","rejected"]);
export const walletTxnTypeEnum = pgEnum("wallet_txn_type", ["earning","withdrawal","bonus","deduction","refund"]);
export const withdrawalMethodEnum = pgEnum("withdrawal_method", ["mobile_money","bank_transfer"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending","processing","completed","failed","cancelled"]);
export const disputeStatusEnum = pgEnum("dispute_status", ["open","investigating","resolved","closed"]);
export const bookingStatusEnum = pgEnum("booking_status", ["pending","accepted","in-progress","completed","rejected","cancelled"]);
export const zoneStatusEnum = pgEnum("zone_status", ["active","inactive"]);
export const customerTxnTypeEnum = pgEnum("customer_txn_type", ["recharge","withdrawal","referral","payment"]);
export const customerTxnStatusEnum = pgEnum("customer_txn_status", ["completed","pending","failed"]);
export const providerEnum = pgEnum("provider_enum", ["mtn_momo","airtel_money","zamtel_money"]);
export const providerRoleEnum = pgEnum("provider_role", ["zone_manager","carrier_driver"]);
export const paymentMethodEnum = pgEnum("payment_method", ["mtn_momo","airtel_money","zamtel_money","bank_transfer","manual"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending","processing","completed","released","failed","refunded","cancelled"]);
export const notificationTypeEnum = pgEnum("notification_type", ["pickup_update","driver_accepted","driver_arriving","pickup_completed","payment","subscription","system","support"]);
export const geometryTypeEnum = pgEnum("geometry_type", ["polygon","circle","point"]);
export const auditActionEnum = pgEnum("audit_action", ["created","modified","deleted","boundary_updated","name_detected","auto_assigned_manager"]);


/* ================= USERS ================= */
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (t) => ({
  openIdIdx: index("users_openId_idx").on(t.openId),
}));

/* ================= DRIVER PROFILES ================= */
export const driverProfiles = pgTable("driver_profiles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull().unique().references(() => users.id),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  vehicleType: vehicleTypeEnum("vehicleType").notNull(),
  plateNumber: varchar("plateNumber", { length: 50 }).notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  isApproved: boolean("isApproved").default(false).notNull(),
  isSuspended: boolean("isSuspended").default(false).notNull(),
  averageRating: numeric("averageRating", { precision: 3, scale: 2 }).default("0.00"),
  totalRatings: integer("totalRatings").default(0),
  totalCompletedJobs: integer("totalCompletedJobs").default(0),
  commissionRate: numeric("commissionRate", { precision: 5, scale: 2 }).default("10.00"),
  approvedAt: timestamp("approvedAt"),
  suspendedAt: timestamp("suspendedAt"),
  suspensionReason: text("suspensionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/* ================= DRIVER DOCUMENTS ================= */
export const driverDocuments = pgTable("driver_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  driverId: integer("driverId").notNull().references(() => driverProfiles.id),
  documentType: documentTypeEnum("documentType").notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileName: varchar("fileName", { length: 255 }),
  isVerified: boolean("isVerified").default(false).notNull(),
  verifiedAt: timestamp("verifiedAt"),
  verifiedBy: integer("verifiedBy").references(() => users.id),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/* ================= TRANSPORT JOBS ================= */
export const transportJobs = pgTable("transport_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  customerId: integer("customerId").notNull().references(() => users.id),
  driverId: integer("driverId").references(() => driverProfiles.id),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  pickupLocation: text("pickupLocation").notNull(),
  pickupLatitude: numeric("pickupLatitude", { precision: 10, scale: 8 }),
  pickupLongitude: numeric("pickupLongitude", { precision: 11, scale: 8 }),
  dropoffLocation: text("dropoffLocation").notNull(),
  dropoffLatitude: numeric("dropoffLatitude", { precision: 10, scale: 8 }),
  dropoffLongitude: numeric("dropoffLongitude", { precision: 11, scale: 8 }),
  distance: numeric("distance", { precision: 10, scale: 2 }),
  cargoType: varchar("cargoType", { length: 255 }),
  cargoDescription: text("cargoDescription"),
  cargoWeight: varchar("cargoWeight", { length: 100 }),
  vehicleRequired: vehicleTypeEnum("vehicleRequired"),
  estimatedPrice: numeric("estimatedPrice", { precision: 10, scale: 2 }),
  finalPrice: numeric("finalPrice", { precision: 10, scale: 2 }),
  commissionAmount: numeric("commissionAmount", { precision: 10, scale: 2 }),
  driverEarnings: numeric("driverEarnings", { precision: 10, scale: 2 }),
  status: transportStatusEnum("status").default("pending").notNull(),
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/* ================= WALLET ================= */
export const driverWallets = pgTable("driver_wallets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  driverId: integer("driverId").notNull().unique().references(() => driverProfiles.id),
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalEarnings: numeric("totalEarnings", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalWithdrawn: numeric("totalWithdrawn", { precision: 12, scale: 2 }).default("0.00").notNull(),
  pendingWithdrawal: numeric("pendingWithdrawal", { precision: 12, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const walletTransactions = pgTable("wallet_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  driverId: integer("driverId").notNull().references(() => driverProfiles.id),
  jobId: integer("jobId").references(() => transportJobs.id),
  type: walletTxnTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric("balanceAfter", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  reference: varchar("reference", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const driverWithdrawals = pgTable("driver_withdrawals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  driverId: integer("driverId").notNull().references(() => driverProfiles.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  withdrawalMethod: withdrawalMethodEnum("withdrawalMethod").notNull(),
  accountNumber: varchar("accountNumber", { length: 100 }).notNull(),
  accountName: varchar("accountName", { length: 255 }),
  bankName: varchar("bankName", { length: 255 }),
  mobileProvider: varchar("mobileProvider", { length: 100 }),
  status: withdrawalStatusEnum("status").default("pending").notNull(),
  processedAt: timestamp("processedAt"),
  processedBy: integer("processedBy").references(() => users.id),
  failureReason: text("failureReason"),
  transactionReference: varchar("transactionReference", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/* ================= DRIVER RATINGS ================= */
export const driverRatings = pgTable("driver_ratings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  driverId: integer("driverId").notNull().references(() => driverProfiles.id),
  customerId: integer("customerId").notNull().references(() => users.id),
  jobId: integer("jobId").notNull().references(() => transportJobs.id),
  rating: integer("rating").notNull(),
  review: text("review"),
  isPublic: boolean("isPublic").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* ================= DRIVER ACTIVITY ================= */
export const driverActivityLog = pgTable("driver_activity_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  driverId: integer("driverId").notNull().references(() => driverProfiles.id),
  activityType: varchar("activityType", { length: 100 }).notNull(),
  jobId: integer("jobId"),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* ================= ADMIN SETTINGS ================= */
export const adminSettings = pgTable("admin_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  description: text("description"),
  updatedBy: integer("updatedBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/* ================= DISPUTES ================= */
export const disputes = pgTable("disputes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer("jobId").notNull().references(() => transportJobs.id),
  reportedBy: integer("reportedBy").notNull().references(() => users.id),
  reportedAgainst: integer("reportedAgainst").notNull().references(() => users.id),
  reporterType: varchar("reporterType", { length: 50 }).notNull(),
  reason: text("reason").notNull(),
  status: disputeStatusEnum("status").default("open").notNull(),
  resolution: text("resolution"),
  resolvedBy: integer("resolvedBy").references(() => users.id),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/* ================= BOOKINGS ================= */
export const bookings = pgTable("bookings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  customerId: integer("customerId").notNull().references(() => users.id),
  driverId: integer("driverId").references(() => driverProfiles.id),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  pickupLocation: text("pickupLocation").notNull(),
  dropoffLocation: text("dropoffLocation").notNull(),
  cargoType: varchar("cargoType", { length: 255 }),
  cargoWeight: varchar("cargoWeight", { length: 100 }),
  estimatedPrice: numeric("estimatedPrice", { precision: 10, scale: 2 }),
  status: bookingStatusEnum("status").default("pending").notNull(),
  vehicleRequired: varchar("vehicleRequired", { length: 255 }),
  scheduledTime: timestamp("scheduledTime"),
  completedAt: timestamp("completedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/* ================= VEHICLES ================= */
export const vehicles = pgTable("vehicles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  driverId: integer("driverId").notNull().references(() => driverProfiles.id),
  vehicleType: varchar("vehicleType", { length: 255 }).notNull(),
  plateNumber: varchar("plateNumber", { length: 50 }).notNull(),
  capacity: varchar("capacity", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/* ================= ZONES ================= */
export const zones = pgTable("zones", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  description: text("description"),
  boundaries: text("boundaries"),
  status: zoneStatusEnum("status").default("active").notNull(),
  householdCount: integer("householdCount").default(0).notNull(),
  collectorCount: integer("collectorCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/* ================= ZONE COLLECTORS ================= */
export const zoneCollectors = pgTable("zone_collectors", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  zoneId: integer("zoneId").notNull().references(() => zones.id),
  collectorId: integer("collectorId").notNull().references(() => driverProfiles.id),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

/* ================= CUSTOMER WALLET ================= */
export const customerWallets = pgTable("customer_wallets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull().references(() => users.id),
  totalBalance: numeric("totalBalance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  rechargedBalance: numeric("rechargedBalance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  referralBalance: numeric("referralBalance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/* ================= CUSTOMER TRANSACTIONS ================= */
export const customerWalletTransactions = pgTable("customer_wallet_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull().references(() => users.id),
  type: customerTxnTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: customerTxnStatusEnum("status").default("pending").notNull(),
  description: text("description"),
  referenceId: varchar("referenceId", { length: 255 }),
  bankDetails: text("bankDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/* ================= PAYMENT TRANSACTIONS ================= */
export const paymentTransactions = pgTable("payment_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

  payerId: integer("payerId").notNull().references(() => users.id),

  providerId: integer("providerId").notNull().references(() => users.id),
  providerRole: providerRoleEnum("providerRole").notNull(),

  serviceType: varchar("serviceType", { length: 50 }).notNull(),

  serviceReferenceId: integer("serviceReferenceId"),

  amountTotal: numeric("amountTotal", { precision: 12, scale: 2 }).notNull(),
  platformCommission: numeric("platformCommission", { precision: 12, scale: 2 }).notNull(),
  providerAmount: numeric("providerAmount", { precision: 12, scale: 2 }).notNull(),

  commissionAmount: numeric("commissionAmount", { precision: 12, scale: 2 }),
  platformAmount: numeric("platformAmount", { precision: 12, scale: 2 }),

  transactionSource: varchar("transactionSource", { length: 50 }),
  appliedCommissionRate: numeric("appliedCommissionRate", { precision: 5, scale: 4 }),

  paymentMethod: paymentMethodEnum("paymentMethod").default("manual").notNull(),
  referenceId: varchar("referenceId", { length: 128 }).unique(),
  callbackPayload: text("callbackPayload"),

  status: paymentStatusEnum("status").default("pending").notNull(),

  withdrawalRequestedAt: timestamp("withdrawalRequestedAt"),
  withdrawalCompletedAt: timestamp("withdrawalCompletedAt"),
  withdrawalReference: varchar("withdrawalReference", { length: 128 }),

  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;

/* ================= PLATFORM WALLET ================= */
export const platformWallet = pgTable("platform_wallet", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  totalCommissionEarned: numeric("totalCommissionEarned", { precision: 14, scale: 2 }).default("0.00").notNull(),
  availableBalance: numeric("availableBalance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  totalWithdrawn: numeric("totalWithdrawn", { precision: 14, scale: 2 }).default("0.00").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type PlatformWallet = typeof platformWallet.$inferSelect;
export type InsertPlatformWallet = typeof platformWallet.$inferInsert;

/* ================= PROVIDER WALLETS ================= */
export const providerWallets = pgTable("provider_wallets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  providerId: integer("providerId").notNull().unique().references(() => users.id),
  providerRole: providerRoleEnum("providerRole").notNull(),
  availableBalance: numeric("availableBalance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalEarned: numeric("totalEarned", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalWithdrawn: numeric("totalWithdrawn", { precision: 12, scale: 2 }).default("0.00").notNull(),
  pendingBalance: numeric("pendingBalance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ProviderWallet = typeof providerWallets.$inferSelect;
export type InsertProviderWallet = typeof providerWallets.$inferInsert;

/* ================= WITHDRAWAL REQUESTS ================= */
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  providerId: integer("providerId").notNull(),
  providerRole: providerRoleEnum("providerRole").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  withdrawalMethod: paymentMethodEnum("withdrawalMethod").notNull(),
  accountNumber: varchar("accountNumber", { length: 64 }).notNull(),
  accountName: varchar("accountName", { length: 255 }),

  status: withdrawalStatusEnum("status").default("pending").notNull(),

  reviewedBy: varchar("reviewedBy", { length: 128 }),
  reviewedAt: timestamp("reviewedAt"),
  adminNotes: text("adminNotes"),

  withdrawalReference: varchar("withdrawalReference", { length: 128 }),
  mtnDisbursementAccepted: boolean("mtnDisbursementAccepted").default(false),

  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = typeof withdrawalRequests.$inferInsert;

/* ================= COMMISSION RULES ================= */
export const commissionRules = pgTable("commission_rules", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  serviceType: varchar("serviceType", { length: 50 }).notNull().unique(),
  rate: numeric("rate", { precision: 5, scale: 4 }).default("0.1000").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  description: text("description"),
  createdBy: varchar("createdBy", { length: 128 }).default("system").notNull(),
  updatedBy: varchar("updatedBy", { length: 128 }).default("system").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CommissionRule = typeof commissionRules.$inferSelect;
export type InsertCommissionRule = typeof commissionRules.$inferInsert;

/* ================= COMMISSION AUDIT ================= */
export const commissionAuditLog = pgTable("commission_audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  serviceType: varchar("serviceType", { length: 50 }).notNull(),
  oldRate: numeric("oldRate", { precision: 5, scale: 4 }).notNull(),
  newRate: numeric("newRate", { precision: 5, scale: 4 }).notNull(),
  changedBy: varchar("changedBy", { length: 128 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* ================= DRIVER STATUS ================= */
export const driverStatus = pgTable("driver_status", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  driverId: integer("driverId").notNull().unique().references(() => driverProfiles.id),
  driverName: varchar("driverName", { length: 255 }),
  zoneId: integer("zoneId").references(() => zones.id),
  latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: numeric("longitude", { precision: 11, scale: 8 }).notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  activePickupId: varchar("activePickupId", { length: 128 }),
  headingDegrees: numeric("headingDegrees", { precision: 6, scale: 2 }),
  speedKmh: numeric("speedKmh", { precision: 6, scale: 2 }),
  lastUpdated: timestamp("lastUpdated").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* ================= USER NOTIFICATIONS ================= */
export const userNotifications = pgTable("user_notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull().references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  data: text("data"),
  pickupId: varchar("pickupId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* ================= ZONE MANAGERS ================= */
export const zoneManagers = pgTable("zone_managers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull().unique().references(() => users.id),
  zoneId: integer("zoneId").notNull().references(() => zones.id),
  status: zoneStatusEnum("status").default("active").notNull(),
  commissionRate: numeric("commissionRate", { precision: 5, scale: 2 }).default("10.00").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  unassignedAt: timestamp("unassignedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ZoneManager = typeof zoneManagers.$inferSelect;
export type InsertZoneManager = typeof zoneManagers.$inferInsert;

/* ================= ZONE MANAGER DRIVERS ================= */
export const zoneManagerDrivers = pgTable("zone_manager_drivers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  zoneManagerId: integer("zoneManagerId").notNull().references(() => zoneManagers.id),
  driverId: integer("driverId").notNull().references(() => driverProfiles.id),
  status: zoneStatusEnum("status").default("active").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  unassignedAt: timestamp("unassignedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ZoneManagerDriver = typeof zoneManagerDrivers.$inferSelect;
export type InsertZoneManagerDriver = typeof zoneManagerDrivers.$inferInsert;

/* ================= CUSTOMER ZONE ASSIGNMENTS ================= */
export const customerZoneAssignments = pgTable("customer_zone_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull().unique().references(() => users.id),
  zoneId: integer("zoneId").notNull().references(() => zones.id),
  address: text("address").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: numeric("longitude", { precision: 11, scale: 8 }).notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CustomerZoneAssignment = typeof customerZoneAssignments.$inferSelect;
export type InsertCustomerZoneAssignment = typeof customerZoneAssignments.$inferInsert;

/* ================= GARBAGE PICKUPS ================= */
export const garbagePickups = pgTable("garbage_pickups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  customerId: integer("customerId").notNull().references(() => users.id),
  zoneId: integer("zoneId").notNull().references(() => zones.id),
  zoneManagerId: integer("zoneManagerId").references(() => zoneManagers.id),
  driverId: integer("driverId").references(() => driverProfiles.id),
  address: text("address").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: numeric("longitude", { precision: 11, scale: 8 }).notNull(),
  status: pickupStatusEnum("status").default("pending").notNull(),
  notes: text("notes"),
  scheduledTime: timestamp("scheduledTime"),
  acceptedAt: timestamp("acceptedAt"),
  assignedAt: timestamp("assignedAt"),
  arrivedAt: timestamp("arrivedAt"),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
  cancellationReason: text("cancellationReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type GarbagePickup = typeof garbagePickups.$inferSelect;
export type InsertGarbagePickup = typeof garbagePickups.$inferInsert;

/* ================= PICKUP ASSIGNMENTS ================= */
export const pickupAssignments = pgTable("pickup_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  pickupId: integer("pickupId").notNull().references(() => garbagePickups.id),
  driverId: integer("driverId").notNull().references(() => driverProfiles.id),
  assignedBy: integer("assignedBy").references(() => zoneManagers.id),
  status: pickupStatusEnum("status").default("pending").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  assignedAt: timestamp("assignedAt"),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type PickupAssignment = typeof pickupAssignments.$inferSelect;
export type InsertPickupAssignment = typeof pickupAssignments.$inferInsert;

/* ================= ZONE GEOMETRIES ================= */
export const zoneGeometries = pgTable("zone_geometries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  zoneId: integer("zoneId").notNull().unique().references(() => zones.id),
  geometryType: geometryTypeEnum("geometryType").default("polygon").notNull(),
  coordinates: text("coordinates").notNull(),
  centerLat: numeric("centerLat", { precision: 10, scale: 8 }),
  centerLng: numeric("centerLng", { precision: 11, scale: 8 }),
  radiusMeters: integer("radiusMeters"),
  createdBy: integer("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ZoneGeometry = typeof zoneGeometries.$inferSelect;
export type InsertZoneGeometry = typeof zoneGeometries.$inferInsert;

/* ================= ZONE ADMIN PROFILES ================= */
export const zoneAdminProfiles = pgTable("zone_admin_profiles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull().unique().references(() => users.id),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  isApproved: boolean("isApproved").default(false).notNull(),
  approvedAt: timestamp("approvedAt"),
  approvedBy: integer("approvedBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ZoneAdminProfile = typeof zoneAdminProfiles.$inferSelect;
export type InsertZoneAdminProfile = typeof zoneAdminProfiles.$inferInsert;

/* ================= ZONE ADMIN ZONES ================= */
export const zoneAdminZones = pgTable("zone_admin_zones", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  zoneAdminId: integer("zoneAdminId").notNull().references(() => zoneAdminProfiles.id),
  zoneId: integer("zoneId").notNull().references(() => zones.id),
  createdBy: integer("createdBy").notNull().references(() => users.id),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type ZoneAdminZone = typeof zoneAdminZones.$inferSelect;
export type InsertZoneAdminZone = typeof zoneAdminZones.$inferInsert;

/* ================= ZONE AUDIT LOG ================= */
export const zoneAuditLog = pgTable("zone_audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  zoneId: integer("zoneId").notNull().references(() => zones.id),
  action: auditActionEnum("action").notNull(),
  createdBy: integer("createdBy").notNull().references(() => users.id),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ZoneAuditLog = typeof zoneAuditLog.$inferSelect;
export type InsertZoneAuditLog = typeof zoneAuditLog.$inferInsert;