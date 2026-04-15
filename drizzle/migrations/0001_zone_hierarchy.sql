-- Zone Managers Table
-- Stores zone manager profiles and their zone assignments
CREATE TABLE IF NOT EXISTS `zone_managers` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL UNIQUE,
  `zoneId` INT NOT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `commissionRate` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  `assignedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unassignedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`zoneId`) REFERENCES `zones`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_zone_manager` (`userId`, `zoneId`),
  INDEX `idx_zone` (`zoneId`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Zone Manager Drivers Table
-- Many-to-many relationship between zone managers and drivers
CREATE TABLE IF NOT EXISTS `zone_manager_drivers` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `zoneManagerId` INT NOT NULL,
  `driverId` INT NOT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `assignedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unassignedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`zoneManagerId`) REFERENCES `zone_managers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`driverId`) REFERENCES `driver_profiles`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_manager_driver` (`zoneManagerId`, `driverId`),
  INDEX `idx_driver` (`driverId`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer Zone Assignments Table
-- Auto-assigns customers to zones based on address/location
CREATE TABLE IF NOT EXISTS `customer_zone_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL UNIQUE,
  `zoneId` INT NOT NULL,
  `address` TEXT NOT NULL,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `assignedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`zoneId`) REFERENCES `zones`(`id`) ON DELETE CASCADE,
  INDEX `idx_zone` (`zoneId`),
  INDEX `idx_user` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Garbage Pickups Table
-- Stores garbage collection pickup requests
CREATE TABLE IF NOT EXISTS `garbage_pickups` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `customerId` INT NOT NULL,
  `zoneId` INT NOT NULL,
  `zoneManagerId` INT,
  `driverId` INT,
  `address` TEXT NOT NULL,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `status` ENUM('pending', 'accepted', 'assigned', 'arrived', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `notes` TEXT,
  `scheduledTime` TIMESTAMP NULL,
  `acceptedAt` TIMESTAMP NULL,
  `assignedAt` TIMESTAMP NULL,
  `arrivedAt` TIMESTAMP NULL,
  `completedAt` TIMESTAMP NULL,
  `cancelledAt` TIMESTAMP NULL,
  `cancellationReason` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`zoneId`) REFERENCES `zones`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`zoneManagerId`) REFERENCES `zone_managers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`driverId`) REFERENCES `driver_profiles`(`id`) ON DELETE SET NULL,
  INDEX `idx_zone` (`zoneId`),
  INDEX `idx_customer` (`customerId`),
  INDEX `idx_driver` (`driverId`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pickup Assignments Table
-- Tracks driver assignments to pickups (manual or auto)
CREATE TABLE IF NOT EXISTS `pickup_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `pickupId` INT NOT NULL,
  `driverId` INT NOT NULL,
  `assignedBy` INT,
  `status` ENUM('pending', 'accepted', 'assigned', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `acceptedAt` TIMESTAMP NULL,
  `assignedAt` TIMESTAMP NULL,
  `completedAt` TIMESTAMP NULL,
  `cancelledAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`pickupId`) REFERENCES `garbage_pickups`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`driverId`) REFERENCES `driver_profiles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`assignedBy`) REFERENCES `zone_managers`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `unique_pickup_driver` (`pickupId`, `driverId`),
  INDEX `idx_driver` (`driverId`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
