CREATE TABLE `admin_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text NOT NULL,
	`description` text,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`driverId` int,
	`customerName` varchar(255) NOT NULL,
	`customerPhone` varchar(20) NOT NULL,
	`pickupLocation` text NOT NULL,
	`dropoffLocation` text NOT NULL,
	`cargoType` varchar(255),
	`cargoWeight` varchar(100),
	`estimatedPrice` decimal(10,2),
	`status` enum('pending','accepted','in-progress','completed','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`vehicleRequired` varchar(255),
	`scheduledTime` timestamp,
	`completedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_linked_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('mtn_momo','airtel_money','zamtel_money') NOT NULL,
	`phoneNumber` varchar(20) NOT NULL,
	`withdrawalPin` varchar(255) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_linked_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_wallet_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('recharge','withdrawal','referral','payment') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('completed','pending','failed') NOT NULL DEFAULT 'pending',
	`description` text,
	`referenceId` varchar(255),
	`bankDetails` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_wallet_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalBalance` decimal(10,2) NOT NULL DEFAULT '0.00',
	`rechargedBalance` decimal(10,2) NOT NULL DEFAULT '0.00',
	`referralBalance` decimal(10,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_wallets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `disputes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`reportedBy` int NOT NULL,
	`reportedAgainst` int NOT NULL,
	`reporterType` enum('customer','driver') NOT NULL,
	`reason` text NOT NULL,
	`status` enum('open','investigating','resolved','closed') NOT NULL DEFAULT 'open',
	`resolution` text,
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `disputes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `driver_activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`activityType` enum('online','offline','job_accepted','job_rejected','job_completed','job_cancelled','withdrawal_requested','profile_updated','document_uploaded') NOT NULL,
	`jobId` int,
	`details` text,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driver_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `driver_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`documentType` enum('drivers_license','nrc_id','passport','vehicle_photo') NOT NULL,
	`fileUrl` text NOT NULL,
	`fileName` varchar(255),
	`isVerified` boolean NOT NULL DEFAULT false,
	`verifiedAt` timestamp,
	`verifiedBy` int,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `driver_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `driver_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320),
	`vehicleType` enum('motorbike','van','pickup','truck','trailer') NOT NULL,
	`plateNumber` varchar(50) NOT NULL,
	`isOnline` boolean NOT NULL DEFAULT false,
	`isApproved` boolean NOT NULL DEFAULT false,
	`isSuspended` boolean NOT NULL DEFAULT false,
	`averageRating` decimal(3,2) DEFAULT '0.00',
	`totalRatings` int DEFAULT 0,
	`totalCompletedJobs` int DEFAULT 0,
	`commissionRate` decimal(5,2) DEFAULT '10.00',
	`approvedAt` timestamp,
	`suspendedAt` timestamp,
	`suspensionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `driver_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `driver_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `driver_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`customerId` int NOT NULL,
	`jobId` int NOT NULL,
	`rating` int NOT NULL,
	`review` text,
	`isPublic` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driver_ratings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `driver_wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`balance` decimal(12,2) NOT NULL DEFAULT '0.00',
	`totalEarnings` decimal(12,2) NOT NULL DEFAULT '0.00',
	`totalWithdrawn` decimal(12,2) NOT NULL DEFAULT '0.00',
	`pendingWithdrawal` decimal(12,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `driver_wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `driver_wallets_driverId_unique` UNIQUE(`driverId`)
);
--> statement-breakpoint
CREATE TABLE `driver_withdrawals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`withdrawalMethod` enum('mobile_money','bank_transfer') NOT NULL,
	`accountNumber` varchar(100) NOT NULL,
	`accountName` varchar(255),
	`bankName` varchar(255),
	`mobileProvider` varchar(100),
	`status` enum('pending','processing','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`processedAt` timestamp,
	`processedBy` int,
	`failureReason` text,
	`transactionReference` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `driver_withdrawals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transport_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`driverId` int,
	`customerName` varchar(255) NOT NULL,
	`customerPhone` varchar(20) NOT NULL,
	`pickupLocation` text NOT NULL,
	`pickupLatitude` decimal(10,8),
	`pickupLongitude` decimal(11,8),
	`dropoffLocation` text NOT NULL,
	`dropoffLatitude` decimal(10,8),
	`dropoffLongitude` decimal(11,8),
	`distance` decimal(10,2),
	`cargoType` varchar(255),
	`cargoDescription` text,
	`cargoWeight` varchar(100),
	`vehicleRequired` enum('motorbike','van','pickup','truck','trailer'),
	`estimatedPrice` decimal(10,2),
	`finalPrice` decimal(10,2),
	`commissionAmount` decimal(10,2),
	`driverEarnings` decimal(10,2),
	`status` enum('pending','accepted','arrived','picked_up','in_transit','delivered','completed','cancelled','rejected') NOT NULL DEFAULT 'pending',
	`scheduledTime` timestamp,
	`acceptedAt` timestamp,
	`arrivedAt` timestamp,
	`pickedUpAt` timestamp,
	`deliveredAt` timestamp,
	`completedAt` timestamp,
	`cancelledAt` timestamp,
	`cancellationReason` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transport_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`vehicleType` varchar(255) NOT NULL,
	`plateNumber` varchar(50) NOT NULL,
	`capacity` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallet_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`jobId` int,
	`type` enum('earning','withdrawal','bonus','deduction','refund') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`balanceAfter` decimal(12,2) NOT NULL,
	`description` text,
	`reference` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallet_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zone_collectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zoneId` int NOT NULL,
	`collectorId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `zone_collectors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`city` varchar(100) NOT NULL,
	`description` text,
	`boundaries` text,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`householdCount` int NOT NULL DEFAULT 0,
	`collectorCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','driver','carrier') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);