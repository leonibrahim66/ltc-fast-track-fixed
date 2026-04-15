CREATE TABLE `payment_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payerId` int NOT NULL,
	`providerId` int NOT NULL,
	`providerRole` enum('zone_manager','carrier_driver') NOT NULL,
	`serviceType` enum('garbage','carrier') NOT NULL,
	`serviceReferenceId` int,
	`amountTotal` decimal(12,2) NOT NULL,
	`platformCommission` decimal(12,2) NOT NULL,
	`providerAmount` decimal(12,2) NOT NULL,
	`paymentMethod` enum('mtn_momo','airtel_money','zamtel_money','bank_transfer','manual') NOT NULL DEFAULT 'manual',
	`referenceId` varchar(128),
	`callbackPayload` text,
	`status` enum('pending','processing','completed','released','failed','refunded','cancelled') NOT NULL DEFAULT 'pending',
	`withdrawalRequestedAt` timestamp,
	`withdrawalCompletedAt` timestamp,
	`withdrawalReference` varchar(128),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_transactions_referenceId_unique` UNIQUE(`referenceId`)
);
--> statement-breakpoint
CREATE TABLE `platform_wallet` (
	`id` int AUTO_INCREMENT NOT NULL,
	`totalCommissionEarned` decimal(14,2) NOT NULL DEFAULT '0.00',
	`availableBalance` decimal(14,2) NOT NULL DEFAULT '0.00',
	`totalWithdrawn` decimal(14,2) NOT NULL DEFAULT '0.00',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_wallet_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int NOT NULL,
	`providerRole` enum('zone_manager','carrier_driver') NOT NULL,
	`availableBalance` decimal(12,2) NOT NULL DEFAULT '0.00',
	`totalEarned` decimal(12,2) NOT NULL DEFAULT '0.00',
	`totalWithdrawn` decimal(12,2) NOT NULL DEFAULT '0.00',
	`pendingBalance` decimal(12,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_wallets_providerId_unique` UNIQUE(`providerId`)
);
