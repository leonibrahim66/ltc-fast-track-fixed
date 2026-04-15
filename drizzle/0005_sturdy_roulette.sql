CREATE TABLE `driver_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` varchar(128) NOT NULL,
	`driverName` varchar(255),
	`zoneId` varchar(128),
	`latitude` decimal(10,8) NOT NULL,
	`longitude` decimal(11,8) NOT NULL,
	`isOnline` boolean NOT NULL DEFAULT false,
	`activePickupId` varchar(128),
	`headingDegrees` decimal(6,2),
	`speedKmh` decimal(6,2),
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driver_status_id` PRIMARY KEY(`id`),
	CONSTRAINT `driver_status_driverId_unique` UNIQUE(`driverId`)
);
