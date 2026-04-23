CREATE TYPE "public"."audit_action" AS ENUM('created', 'modified', 'deleted', 'boundary_updated', 'name_detected', 'auto_assigned_manager');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'accepted', 'in-progress', 'completed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."customer_txn_status" AS ENUM('completed', 'pending', 'failed');--> statement-breakpoint
CREATE TYPE "public"."customer_txn_type" AS ENUM('recharge', 'withdrawal', 'referral', 'payment');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'investigating', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('drivers_license', 'nrc_id', 'passport', 'vehicle_photo');--> statement-breakpoint
CREATE TYPE "public"."geometry_type" AS ENUM('polygon', 'circle', 'point');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('pickup_update', 'driver_accepted', 'driver_arriving', 'pickup_completed', 'payment', 'subscription', 'system', 'support');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('mtn_momo', 'airtel_money', 'zamtel_money', 'bank_transfer', 'manual');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'completed', 'released', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pickup_status" AS ENUM('pending', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."provider_enum" AS ENUM('mtn_momo', 'airtel_money', 'zamtel_money');--> statement-breakpoint
CREATE TYPE "public"."provider_role" AS ENUM('zone_manager', 'carrier_driver');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin', 'driver', 'carrier');--> statement-breakpoint
CREATE TYPE "public"."transport_status" AS ENUM('pending', 'accepted', 'arrived', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('motorbike', 'van', 'pickup', 'truck', 'trailer');--> statement-breakpoint
CREATE TYPE "public"."wallet_txn_type" AS ENUM('earning', 'withdrawal', 'bonus', 'deduction', 'refund');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_method" AS ENUM('mobile_money', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."zone_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "admin_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"settingKey" varchar(100) NOT NULL,
	"settingValue" text NOT NULL,
	"description" text,
	"updatedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_settings_settingKey_unique" UNIQUE("settingKey")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bookings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customerId" integer NOT NULL,
	"driverId" integer,
	"customerName" varchar(255) NOT NULL,
	"customerPhone" varchar(20) NOT NULL,
	"pickupLocation" text NOT NULL,
	"dropoffLocation" text NOT NULL,
	"cargoType" varchar(255),
	"cargoWeight" varchar(100),
	"estimatedPrice" numeric(10, 2),
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"vehicleRequired" varchar(255),
	"scheduledTime" timestamp,
	"completedAt" timestamp,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "commission_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"serviceType" varchar(50) NOT NULL,
	"oldRate" numeric(5, 4) NOT NULL,
	"newRate" numeric(5, 4) NOT NULL,
	"changedBy" varchar(128) NOT NULL,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "commission_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"serviceType" varchar(50) NOT NULL,
	"rate" numeric(5, 4) DEFAULT '0.1000' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"description" text,
	"createdBy" varchar(128) DEFAULT 'system' NOT NULL,
	"updatedBy" varchar(128) DEFAULT 'system' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "commission_rules_serviceType_unique" UNIQUE("serviceType")
);
--> statement-breakpoint
CREATE TABLE "customer_wallet_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_wallet_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"type" "customer_txn_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "customer_txn_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"referenceId" varchar(255),
	"bankDetails" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_wallets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_wallets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"totalBalance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"rechargedBalance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"referralBalance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_zone_assignments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_zone_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"zoneId" integer NOT NULL,
	"address" text NOT NULL,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"assignedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_zone_assignments_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "disputes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"jobId" integer NOT NULL,
	"reportedBy" integer NOT NULL,
	"reportedAgainst" integer NOT NULL,
	"reporterType" varchar(50) NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolvedBy" integer,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_activity_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "driver_activity_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"driverId" integer NOT NULL,
	"activityType" varchar(100) NOT NULL,
	"jobId" integer,
	"details" text,
	"ipAddress" varchar(45),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "driver_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"driverId" integer NOT NULL,
	"documentType" "document_type" NOT NULL,
	"fileUrl" text NOT NULL,
	"fileName" varchar(255),
	"isVerified" boolean DEFAULT false NOT NULL,
	"verifiedAt" timestamp,
	"verifiedBy" integer,
	"rejectionReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_profiles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "driver_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(320),
	"vehicleType" "vehicle_type" NOT NULL,
	"plateNumber" varchar(50) NOT NULL,
	"isOnline" boolean DEFAULT false NOT NULL,
	"isApproved" boolean DEFAULT false NOT NULL,
	"isSuspended" boolean DEFAULT false NOT NULL,
	"averageRating" numeric(3, 2) DEFAULT '0.00',
	"totalRatings" integer DEFAULT 0,
	"totalCompletedJobs" integer DEFAULT 0,
	"commissionRate" numeric(5, 2) DEFAULT '10.00',
	"approvedAt" timestamp,
	"suspendedAt" timestamp,
	"suspensionReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "driver_profiles_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "driver_ratings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "driver_ratings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"driverId" integer NOT NULL,
	"customerId" integer NOT NULL,
	"jobId" integer NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"isPublic" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_status" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "driver_status_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"driverId" integer NOT NULL,
	"driverName" varchar(255),
	"zoneId" integer,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"isOnline" boolean DEFAULT false NOT NULL,
	"activePickupId" varchar(128),
	"headingDegrees" numeric(6, 2),
	"speedKmh" numeric(6, 2),
	"lastUpdated" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "driver_status_driverId_unique" UNIQUE("driverId")
);
--> statement-breakpoint
CREATE TABLE "driver_wallets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "driver_wallets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"driverId" integer NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"totalEarnings" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"totalWithdrawn" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"pendingWithdrawal" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "driver_wallets_driverId_unique" UNIQUE("driverId")
);
--> statement-breakpoint
CREATE TABLE "driver_withdrawals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "driver_withdrawals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"driverId" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"withdrawalMethod" "withdrawal_method" NOT NULL,
	"accountNumber" varchar(100) NOT NULL,
	"accountName" varchar(255),
	"bankName" varchar(255),
	"mobileProvider" varchar(100),
	"status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"processedAt" timestamp,
	"processedBy" integer,
	"failureReason" text,
	"transactionReference" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garbage_pickups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "garbage_pickups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customerId" integer NOT NULL,
	"zoneId" integer NOT NULL,
	"zoneManagerId" integer,
	"driverId" integer,
	"address" text NOT NULL,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"status" "pickup_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"scheduledTime" timestamp,
	"acceptedAt" timestamp,
	"assignedAt" timestamp,
	"arrivedAt" timestamp,
	"completedAt" timestamp,
	"cancelledAt" timestamp,
	"cancellationReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"payerId" integer NOT NULL,
	"providerId" integer NOT NULL,
	"providerRole" "provider_role" NOT NULL,
	"serviceType" varchar(50) NOT NULL,
	"serviceReferenceId" integer,
	"amountTotal" numeric(12, 2) NOT NULL,
	"platformCommission" numeric(12, 2) NOT NULL,
	"providerAmount" numeric(12, 2) NOT NULL,
	"commissionAmount" numeric(12, 2),
	"platformAmount" numeric(12, 2),
	"transactionSource" varchar(50),
	"appliedCommissionRate" numeric(5, 4),
	"paymentMethod" "payment_method" DEFAULT 'manual' NOT NULL,
	"referenceId" varchar(128),
	"callbackPayload" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"withdrawalRequestedAt" timestamp,
	"withdrawalCompletedAt" timestamp,
	"withdrawalReference" varchar(128),
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transactions_referenceId_unique" UNIQUE("referenceId")
);
--> statement-breakpoint
CREATE TABLE "pickup_assignments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pickup_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pickupId" integer NOT NULL,
	"driverId" integer NOT NULL,
	"assignedBy" integer,
	"status" "pickup_status" DEFAULT 'pending' NOT NULL,
	"acceptedAt" timestamp,
	"assignedAt" timestamp,
	"completedAt" timestamp,
	"cancelledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_wallet" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "platform_wallet_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"totalCommissionEarned" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"availableBalance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"totalWithdrawn" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_wallets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "provider_wallets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"providerId" integer NOT NULL,
	"providerRole" "provider_role" NOT NULL,
	"availableBalance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"totalEarned" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"totalWithdrawn" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"pendingBalance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_wallets_providerId_unique" UNIQUE("providerId")
);
--> statement-breakpoint
CREATE TABLE "transport_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transport_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customerId" integer NOT NULL,
	"driverId" integer,
	"customerName" varchar(255) NOT NULL,
	"customerPhone" varchar(20) NOT NULL,
	"pickupLocation" text NOT NULL,
	"pickupLatitude" numeric(10, 8),
	"pickupLongitude" numeric(11, 8),
	"dropoffLocation" text NOT NULL,
	"dropoffLatitude" numeric(10, 8),
	"dropoffLongitude" numeric(11, 8),
	"distance" numeric(10, 2),
	"cargoType" varchar(255),
	"cargoDescription" text,
	"cargoWeight" varchar(100),
	"vehicleRequired" "vehicle_type",
	"estimatedPrice" numeric(10, 2),
	"finalPrice" numeric(10, 2),
	"commissionAmount" numeric(10, 2),
	"driverEarnings" numeric(10, 2),
	"status" "transport_status" DEFAULT 'pending' NOT NULL,
	"scheduledTime" timestamp,
	"acceptedAt" timestamp,
	"arrivedAt" timestamp,
	"pickedUpAt" timestamp,
	"deliveredAt" timestamp,
	"completedAt" timestamp,
	"cancelledAt" timestamp,
	"cancellationReason" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"data" text,
	"pickupId" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"phone" varchar(20),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"driverId" integer NOT NULL,
	"vehicleType" varchar(255) NOT NULL,
	"plateNumber" varchar(50) NOT NULL,
	"capacity" varchar(100),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wallet_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"driverId" integer NOT NULL,
	"jobId" integer,
	"type" "wallet_txn_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balanceAfter" numeric(12, 2) NOT NULL,
	"description" text,
	"reference" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "withdrawal_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"providerId" integer NOT NULL,
	"providerRole" "provider_role" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"withdrawalMethod" "payment_method" NOT NULL,
	"accountNumber" varchar(64) NOT NULL,
	"accountName" varchar(255),
	"status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"reviewedBy" varchar(128),
	"reviewedAt" timestamp,
	"adminNotes" text,
	"withdrawalReference" varchar(128),
	"mtnDisbursementAccepted" boolean DEFAULT false,
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_admin_profiles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zone_admin_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(320),
	"isApproved" boolean DEFAULT false NOT NULL,
	"approvedAt" timestamp,
	"approvedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "zone_admin_profiles_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "zone_admin_zones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zone_admin_zones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"zoneAdminId" integer NOT NULL,
	"zoneId" integer NOT NULL,
	"createdBy" integer NOT NULL,
	"assignedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zone_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"zoneId" integer NOT NULL,
	"action" "audit_action" NOT NULL,
	"createdBy" integer NOT NULL,
	"details" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_collectors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zone_collectors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"zoneId" integer NOT NULL,
	"collectorId" integer NOT NULL,
	"assignedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_geometries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zone_geometries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"zoneId" integer NOT NULL,
	"geometryType" geometry_type DEFAULT 'polygon' NOT NULL,
	"coordinates" text NOT NULL,
	"centerLat" numeric(10, 8),
	"centerLng" numeric(11, 8),
	"radiusMeters" integer,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "zone_geometries_zoneId_unique" UNIQUE("zoneId")
);
--> statement-breakpoint
CREATE TABLE "zone_manager_drivers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zone_manager_drivers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"zoneManagerId" integer NOT NULL,
	"driverId" integer NOT NULL,
	"status" "zone_status" DEFAULT 'active' NOT NULL,
	"assignedAt" timestamp DEFAULT now() NOT NULL,
	"unassignedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_managers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zone_managers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"zoneId" integer NOT NULL,
	"status" "zone_status" DEFAULT 'active' NOT NULL,
	"commissionRate" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"assignedAt" timestamp DEFAULT now() NOT NULL,
	"unassignedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "zone_managers_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"city" varchar(100) NOT NULL,
	"description" text,
	"boundaries" text,
	"status" "zone_status" DEFAULT 'active' NOT NULL,
	"householdCount" integer DEFAULT 0 NOT NULL,
	"collectorCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_settings" ADD CONSTRAINT "admin_settings_updatedBy_users_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_users_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wallet_transactions" ADD CONSTRAINT "customer_wallet_transactions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wallets" ADD CONSTRAINT "customer_wallets_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_zone_assignments" ADD CONSTRAINT "customer_zone_assignments_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_zone_assignments" ADD CONSTRAINT "customer_zone_assignments_zoneId_zones_id_fk" FOREIGN KEY ("zoneId") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_jobId_transport_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."transport_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_reportedBy_users_id_fk" FOREIGN KEY ("reportedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_reportedAgainst_users_id_fk" FOREIGN KEY ("reportedAgainst") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolvedBy_users_id_fk" FOREIGN KEY ("resolvedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_activity_log" ADD CONSTRAINT "driver_activity_log_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_verifiedBy_users_id_fk" FOREIGN KEY ("verifiedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_customerId_users_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_jobId_transport_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."transport_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_status" ADD CONSTRAINT "driver_status_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_status" ADD CONSTRAINT "driver_status_zoneId_zones_id_fk" FOREIGN KEY ("zoneId") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_wallets" ADD CONSTRAINT "driver_wallets_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_withdrawals" ADD CONSTRAINT "driver_withdrawals_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_withdrawals" ADD CONSTRAINT "driver_withdrawals_processedBy_users_id_fk" FOREIGN KEY ("processedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garbage_pickups" ADD CONSTRAINT "garbage_pickups_customerId_users_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garbage_pickups" ADD CONSTRAINT "garbage_pickups_zoneId_zones_id_fk" FOREIGN KEY ("zoneId") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garbage_pickups" ADD CONSTRAINT "garbage_pickups_zoneManagerId_zone_managers_id_fk" FOREIGN KEY ("zoneManagerId") REFERENCES "public"."zone_managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garbage_pickups" ADD CONSTRAINT "garbage_pickups_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payerId_users_id_fk" FOREIGN KEY ("payerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_providerId_users_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_assignments" ADD CONSTRAINT "pickup_assignments_pickupId_garbage_pickups_id_fk" FOREIGN KEY ("pickupId") REFERENCES "public"."garbage_pickups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_assignments" ADD CONSTRAINT "pickup_assignments_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_assignments" ADD CONSTRAINT "pickup_assignments_assignedBy_zone_managers_id_fk" FOREIGN KEY ("assignedBy") REFERENCES "public"."zone_managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_wallets" ADD CONSTRAINT "provider_wallets_providerId_users_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_jobs" ADD CONSTRAINT "transport_jobs_customerId_users_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_jobs" ADD CONSTRAINT "transport_jobs_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_jobId_transport_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."transport_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_admin_profiles" ADD CONSTRAINT "zone_admin_profiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_admin_profiles" ADD CONSTRAINT "zone_admin_profiles_approvedBy_users_id_fk" FOREIGN KEY ("approvedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_admin_zones" ADD CONSTRAINT "zone_admin_zones_zoneAdminId_zone_admin_profiles_id_fk" FOREIGN KEY ("zoneAdminId") REFERENCES "public"."zone_admin_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_admin_zones" ADD CONSTRAINT "zone_admin_zones_zoneId_zones_id_fk" FOREIGN KEY ("zoneId") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_admin_zones" ADD CONSTRAINT "zone_admin_zones_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_audit_log" ADD CONSTRAINT "zone_audit_log_zoneId_zones_id_fk" FOREIGN KEY ("zoneId") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_audit_log" ADD CONSTRAINT "zone_audit_log_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_collectors" ADD CONSTRAINT "zone_collectors_zoneId_zones_id_fk" FOREIGN KEY ("zoneId") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_collectors" ADD CONSTRAINT "zone_collectors_collectorId_driver_profiles_id_fk" FOREIGN KEY ("collectorId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_geometries" ADD CONSTRAINT "zone_geometries_zoneId_zones_id_fk" FOREIGN KEY ("zoneId") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_geometries" ADD CONSTRAINT "zone_geometries_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_manager_drivers" ADD CONSTRAINT "zone_manager_drivers_zoneManagerId_zone_managers_id_fk" FOREIGN KEY ("zoneManagerId") REFERENCES "public"."zone_managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_manager_drivers" ADD CONSTRAINT "zone_manager_drivers_driverId_driver_profiles_id_fk" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_managers" ADD CONSTRAINT "zone_managers_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_managers" ADD CONSTRAINT "zone_managers_zoneId_zones_id_fk" FOREIGN KEY ("zoneId") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_openId_idx" ON "users" USING btree ("openId");