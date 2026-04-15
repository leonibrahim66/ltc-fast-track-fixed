CREATE TABLE `commission_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceType` enum('garbage','carrier','subscription') NOT NULL,
	`oldRate` decimal(5,4) NOT NULL,
	`newRate` decimal(5,4) NOT NULL,
	`changedBy` varchar(128) NOT NULL,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commission_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commission_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceType` enum('garbage','carrier','subscription') NOT NULL,
	`rate` decimal(5,4) NOT NULL DEFAULT '0.1000',
	`isActive` boolean NOT NULL DEFAULT true,
	`description` text,
	`createdBy` varchar(128) NOT NULL DEFAULT 'system',
	`updatedBy` varchar(128) NOT NULL DEFAULT 'system',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commission_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `commission_rules_serviceType_unique` UNIQUE(`serviceType`)
);
--> statement-breakpoint
ALTER TABLE `payment_transactions` ADD `commissionAmount` decimal(12,2);--> statement-breakpoint
ALTER TABLE `payment_transactions` ADD `platformAmount` decimal(12,2);--> statement-breakpoint
ALTER TABLE `payment_transactions` ADD `transactionSource` enum('garbage','carrier','subscription');--> statement-breakpoint
ALTER TABLE `payment_transactions` ADD `appliedCommissionRate` decimal(5,4);