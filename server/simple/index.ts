/**
 * LTC Fast Track — Production Backend Server
 * Stack: Express + pg (PostgreSQL) + axios
 * Uses ltc_* prefixed tables to avoid conflicts with existing schema
 */

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import bcrypt from "bcrypt";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const NODE_ENV = process.env.NODE_ENV ?? "development";
const PAWAPAY_API_KEY = process.env.PAWAPAY_API_KEY ?? "";

if (!PAWAPAY_API_KEY) { console.error("[FATAL] PAWAPAY_API_KEY is not set."); process.exit(1); }

const PAWAPAY_BASE_URL = NODE_ENV === "production" ? "https://api.pawapay.io" : "https://api.sandbox.pawapay.io";
const CALLBACK_BASE_URL = process.env.CALLBACK_BASE_URL ?? `http://localhost:${PORT}`;

type LogLevel = "INFO" | "WARN" | "ERROR" | "PAYMENT" | "CALLBACK" | "WITHDRAWAL";
function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = { ts: new Date().toISOString(), level, message, ...(meta ? { meta } : {}) };
  level === "ERROR" ? console.error(JSON.stringify(entry)) : console.log(JSON.stringify(entry));
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") || NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function initDB(): Promise<void> {
  const client = await pool.connect();

  try {
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS ltc_users (
        id TEXT PRIMARY KEY,
        name TEXT,
        "phoneNumber" TEXT NOT NULL UNIQUE,
        country TEXT NOT NULL DEFAULT 'ZMB',
        province TEXT,
        city TEXT,
        town TEXT,
        "fullAddress" TEXT,
        "createdAt" TEXT NOT NULL DEFAULT to_char(
          now() AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        )
      );

      CREATE TABLE IF NOT EXISTS ltc_wallets (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL UNIQUE REFERENCES ltc_users(id) ON DELETE CASCADE,
        balance NUMERIC NOT NULL DEFAULT 0,
        "updatedAt" TEXT NOT NULL DEFAULT to_char(
          now() AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        )
      );

      CREATE TABLE IF NOT EXISTS ltc_transactions (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES ltc_users(id) ON DELETE CASCADE,
        "depositId" TEXT NOT NULL UNIQUE,
        amount NUMERIC NOT NULL,
        type TEXT NOT NULL DEFAULT 'deposit',
        status TEXT NOT NULL DEFAULT 'pending',
        provider TEXT,
        "phoneNumber" TEXT,
        "createdAt" TEXT NOT NULL DEFAULT to_char(
          now() AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        ),
        "updatedAt" TEXT NOT NULL DEFAULT to_char(
          now() AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        )
      );

      CREATE TABLE IF NOT EXISTS ltc_linked_accounts (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL UNIQUE REFERENCES ltc_users(id) ON DELETE CASCADE,
        "phoneNumber" TEXT NOT NULL,
        provider TEXT NOT NULL,
        "withdrawalPin" TEXT NOT NULL,
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TEXT NOT NULL DEFAULT to_char(
          now() AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        ),
        "updatedAt" TEXT NOT NULL DEFAULT to_char(
          now() AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        )
      );

      CREATE TABLE IF NOT EXISTS ltc_pickups (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES ltc_users(id) ON DELETE CASCADE,
        "userName" TEXT,
        "userPhone" TEXT,
        location TEXT,
        latitude NUMERIC,
        longitude NUMERIC,
        "wasteType" TEXT NOT NULL DEFAULT 'residential',
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        "zoneId" TEXT,
        "scheduledDate" TEXT,
        "scheduledTime" TEXT,
        "assignedTo" TEXT,
        "completedAt" TEXT,
        "createdAt" TEXT NOT NULL DEFAULT to_char(
          now() AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        ),
        "updatedAt" TEXT NOT NULL DEFAULT to_char(
          now() AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        )
      );
    `);

    // Migration for databases created before the name column existed
    await client.query(`
      ALTER TABLE ltc_users
      ADD COLUMN IF NOT EXISTS name TEXT;
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ltc_txn_uid
        ON ltc_transactions("userId");

      CREATE INDEX IF NOT EXISTS idx_ltc_txn_depid
        ON ltc_transactions("depositId");

      CREATE INDEX IF NOT EXISTS idx_ltc_txn_status
        ON ltc_transactions(status);

      CREATE INDEX IF NOT EXISTS idx_ltc_wal_uid
        ON ltc_wallets("userId");

      CREATE INDEX IF NOT EXISTS idx_ltc_lnk_uid
        ON ltc_linked_accounts("userId");

      CREATE INDEX IF NOT EXISTS idx_ltc_pck_uid
        ON ltc_pickups("userId");

      CREATE INDEX IF NOT EXISTS idx_ltc_pck_status
        ON ltc_pickups(status);
    `);

      // ============================================================
      // LTC FAST TRACK — EXISTING OPERATIONAL TABLES
      // These tables already exist in Railway PostgreSQL.
      // Do NOT modify the existing ltc_* tables above.
      // ============================================================

      // ---------- ENUM TYPES ----------
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE role AS ENUM ('user','admin','driver','carrier');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE vehicle_type AS ENUM ('motorbike','van','pickup','truck','trailer');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE pickup_status AS ENUM ('pending','assigned','accepted','in_progress','completed','cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE document_type AS ENUM ('drivers_license','nrc_id','passport','vehicle_photo');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE transport_status AS ENUM ('pending','accepted','arrived','picked_up','in_transit','delivered','completed','cancelled','rejected');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE wallet_txn_type AS ENUM ('earning','withdrawal','bonus','deduction','refund');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE withdrawal_method AS ENUM ('mobile_money','bank_transfer');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE withdrawal_status AS ENUM ('pending','processing','completed','failed','cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE dispute_status AS ENUM ('open','investigating','resolved','closed');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE booking_status AS ENUM ('pending','accepted','in-progress','completed','rejected','cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE zone_status AS ENUM ('active','inactive');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE customer_txn_type AS ENUM ('recharge','withdrawal','referral','payment');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE customer_txn_status AS ENUM ('completed','pending','failed');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE provider_enum AS ENUM ('mtn_momo','airtel_money','zamtel_money');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE provider_role AS ENUM ('zone_manager','carrier_driver');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE payment_method AS ENUM ('mtn_momo','airtel_money','zamtel_money','bank_transfer','manual');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE payment_status AS ENUM ('pending','processing','completed','released','failed','refunded','cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE notification_type AS ENUM ('pickup_update','driver_accepted','driver_arriving','pickup_completed','payment','subscription','system','support');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE geometry_type AS ENUM ('polygon','circle','point');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN
          CREATE TYPE audit_action AS ENUM ('created','modified','deleted','boundary_updated','name_detected','auto_assigned_manager');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `);

      // ============================================================
      // 1. USERS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "openId" VARCHAR(64) NOT NULL UNIQUE,
          name TEXT,
          email VARCHAR(320),
          phone VARCHAR(20),
          "loginMethod" VARCHAR(64),
          role role NOT NULL DEFAULT 'user',
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "lastSignedIn" TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS users_openId_idx
        ON users ("openId");
      `);

       await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "ltcUserId" TEXT;

        CREATE UNIQUE INDEX IF NOT EXISTS users_ltc_user_id_unique
        ON users ("ltcUserId")
        WHERE "ltcUserId" IS NOT NULL;
      `);

      // ============================================================
      // 2. DRIVER PROFILES
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS driver_profiles (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "userId" INTEGER NOT NULL UNIQUE REFERENCES users(id),
          "fullName" VARCHAR(255) NOT NULL,
          phone VARCHAR(20) NOT NULL,
          email VARCHAR(320),
          "vehicleType" vehicle_type NOT NULL,
          "plateNumber" VARCHAR(50) NOT NULL,
          "isOnline" BOOLEAN NOT NULL DEFAULT FALSE,
          "isApproved" BOOLEAN NOT NULL DEFAULT FALSE,
          "isSuspended" BOOLEAN NOT NULL DEFAULT FALSE,
          "averageRating" NUMERIC(3,2) DEFAULT '0.00',
          "totalRatings" INTEGER DEFAULT 0,
          "totalCompletedJobs" INTEGER DEFAULT 0,
          "commissionRate" NUMERIC(5,2) DEFAULT '10.00',
          "approvedAt" TIMESTAMP,
          "suspendedAt" TIMESTAMP,
          "suspensionReason" TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 3. DRIVER DOCUMENTS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS driver_documents (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "driverId" INTEGER NOT NULL REFERENCES driver_profiles(id),
          "documentType" document_type NOT NULL,
          "fileUrl" TEXT NOT NULL,
          "fileName" VARCHAR(255),
          "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
          "verifiedAt" TIMESTAMP,
          "verifiedBy" INTEGER REFERENCES users(id),
          "rejectionReason" TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

       // ============================================================
       // LINKED ACCOUNTS
       // ============================================================

       await client.query(`
         CREATE TABLE IF NOT EXISTS linked_accounts (
           id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
           "userId" INTEGER NOT NULL REFERENCES users(id),
           "phoneNumber" VARCHAR(20) NOT NULL,
           provider provider_enum NOT NULL,
           "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
           "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
           "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
         );
      `);

       await client.query(` 
        CREATE UNIQUE INDEX IF NOT EXISTS linked_accounts_user_id_unique
        ON linked_accounts("userId");
      `);

      // ============================================================
      // 4. TRANSPORT JOBS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS transport_jobs (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "customerId" INTEGER NOT NULL REFERENCES users(id),
          "driverId" INTEGER REFERENCES driver_profiles(id),
          "customerName" VARCHAR(255) NOT NULL,
          "customerPhone" VARCHAR(20) NOT NULL,
          "pickupLocation" TEXT NOT NULL,
          "pickupLatitude" NUMERIC(10,8),
          "pickupLongitude" NUMERIC(11,8),
          "dropoffLocation" TEXT NOT NULL,
          "dropoffLatitude" NUMERIC(10,8),
          "dropoffLongitude" NUMERIC(11,8),
          distance NUMERIC(10,2),
          "cargoType" VARCHAR(255),
          "cargoDescription" TEXT,
          "cargoWeight" VARCHAR(100),
          "vehicleRequired" vehicle_type,
          "estimatedPrice" NUMERIC(10,2),
          "finalPrice" NUMERIC(10,2),
          "commissionAmount" NUMERIC(10,2),
          "driverEarnings" NUMERIC(10,2),
          status transport_status NOT NULL DEFAULT 'pending',
          "scheduledTime" TIMESTAMP,
          "acceptedAt" TIMESTAMP,
          "arrivedAt" TIMESTAMP,
          "pickedUpAt" TIMESTAMP,
          "deliveredAt" TIMESTAMP,
          "completedAt" TIMESTAMP,
          "cancelledAt" TIMESTAMP,
          "cancellationReason" TEXT,
          notes TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 5. DRIVER WALLETS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS driver_wallets (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "driverId" INTEGER NOT NULL UNIQUE REFERENCES driver_profiles(id),
          balance NUMERIC(12,2) NOT NULL DEFAULT '0.00',
          "totalEarnings" NUMERIC(12,2) NOT NULL DEFAULT '0.00',
          "totalWithdrawn" NUMERIC(12,2) NOT NULL DEFAULT '0.00',
          "pendingWithdrawal" NUMERIC(12,2) NOT NULL DEFAULT '0.00',
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 6. WALLET TRANSACTIONS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "driverId" INTEGER NOT NULL REFERENCES driver_profiles(id),
          "jobId" INTEGER REFERENCES transport_jobs(id),
          type wallet_txn_type NOT NULL,
          amount NUMERIC(10,2) NOT NULL,
          "balanceAfter" NUMERIC(12,2) NOT NULL,
          description TEXT,
          reference VARCHAR(100),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 7. DRIVER WITHDRAWALS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS driver_withdrawals (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "driverId" INTEGER NOT NULL REFERENCES driver_profiles(id),
          amount NUMERIC(10,2) NOT NULL,
          "withdrawalMethod" withdrawal_method NOT NULL,
          "accountNumber" VARCHAR(100) NOT NULL,
          "accountName" VARCHAR(255),
          "bankName" VARCHAR(255),
          "mobileProvider" VARCHAR(100),
          status withdrawal_status NOT NULL DEFAULT 'pending',
          "processedAt" TIMESTAMP,
          "processedBy" INTEGER REFERENCES users(id),
          "failureReason" TEXT,
          "transactionReference" VARCHAR(100),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 8. DRIVER RATINGS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS driver_ratings (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "driverId" INTEGER NOT NULL REFERENCES driver_profiles(id),
          "customerId" INTEGER NOT NULL REFERENCES users(id),
          "jobId" INTEGER NOT NULL REFERENCES transport_jobs(id),
          rating INTEGER NOT NULL,
          review TEXT,
          "isPublic" BOOLEAN NOT NULL DEFAULT TRUE,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 9. DRIVER ACTIVITY LOG
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS driver_activity_log (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "driverId" INTEGER NOT NULL REFERENCES driver_profiles(id),
          "activityType" VARCHAR(100) NOT NULL,
          "jobId" INTEGER,
          details TEXT,
          "ipAddress" VARCHAR(45),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 10. ADMIN SETTINGS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_settings (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "settingKey" VARCHAR(100) NOT NULL UNIQUE,
          "settingValue" TEXT NOT NULL,
          description TEXT,
          "updatedBy" INTEGER REFERENCES users(id),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 11. DISPUTES
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS disputes (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "jobId" INTEGER NOT NULL REFERENCES transport_jobs(id),
          "reportedBy" INTEGER NOT NULL REFERENCES users(id),
          "reportedAgainst" INTEGER NOT NULL REFERENCES users(id),
          "reporterType" VARCHAR(50) NOT NULL,
          reason TEXT NOT NULL,
          status dispute_status NOT NULL DEFAULT 'open',
          resolution TEXT,
          "resolvedBy" INTEGER REFERENCES users(id),
          "resolvedAt" TIMESTAMP,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 12. BOOKINGS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "customerId" INTEGER NOT NULL REFERENCES users(id),
          "driverId" INTEGER REFERENCES driver_profiles(id),
          "customerName" VARCHAR(255) NOT NULL,
          "customerPhone" VARCHAR(20) NOT NULL,
          "pickupLocation" TEXT NOT NULL,
          "dropoffLocation" TEXT NOT NULL,
          "cargoType" VARCHAR(255),
          "cargoWeight" VARCHAR(100),
          "estimatedPrice" NUMERIC(10,2),
          status booking_status NOT NULL DEFAULT 'pending',
          "vehicleRequired" VARCHAR(255),
          "scheduledTime" TIMESTAMP,
          "completedAt" TIMESTAMP,
          notes TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 13. VEHICLES
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "driverId" INTEGER NOT NULL REFERENCES driver_profiles(id),
          "vehicleType" VARCHAR(255) NOT NULL,
          "plateNumber" VARCHAR(50) NOT NULL,
          capacity VARCHAR(100),
          "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 14. ZONES
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS zones (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          name VARCHAR(255) NOT NULL,
          city VARCHAR(100) NOT NULL,
          description TEXT,
          boundaries TEXT,
          status zone_status NOT NULL DEFAULT 'active',
          "householdCount" INTEGER NOT NULL DEFAULT 0,
          "collectorCount" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 15. ZONE COLLECTORS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS zone_collectors (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "zoneId" INTEGER NOT NULL REFERENCES zones(id),
          "collectorId" INTEGER NOT NULL REFERENCES driver_profiles(id),
          "assignedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 16. CUSTOMER WALLETS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS customer_wallets (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "userId" INTEGER NOT NULL REFERENCES users(id),
          "totalBalance" NUMERIC(10,2) NOT NULL DEFAULT '0.00',
          "rechargedBalance" NUMERIC(10,2) NOT NULL DEFAULT '0.00',
          "referralBalance" NUMERIC(10,2) NOT NULL DEFAULT '0.00',
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`  CREATE UNIQUE INDEX IF NOT EXISTS customer_wallets_user_id_unique  ON customer_wallets       ("userId");
     `);   

      // ============================================================
      // 17. CUSTOMER WALLET TRANSACTIONS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS customer_wallet_transactions (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "userId" INTEGER NOT NULL REFERENCES users(id),
          type customer_txn_type NOT NULL,
          amount NUMERIC(10,2) NOT NULL,
          status customer_txn_status NOT NULL DEFAULT 'pending',
          description TEXT,
          "referenceId" VARCHAR(255),
          "bankDetails" TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 18. PAYMENT TRANSACTIONS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS payment_transactions (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "payerId" INTEGER NOT NULL REFERENCES users(id),
          "providerId" INTEGER NOT NULL REFERENCES users(id),
          "providerRole" provider_role NOT NULL,
          "serviceType" VARCHAR(50) NOT NULL,
          "serviceReferenceId" INTEGER,
          "amountTotal" NUMERIC(12,2) NOT NULL,
          "platformCommission" NUMERIC(12,2) NOT NULL,
          "providerAmount" NUMERIC(12,2) NOT NULL,
          "commissionAmount" NUMERIC(12,2),
          "platformAmount" NUMERIC(12,2),
          "transactionSource" VARCHAR(50),
          "appliedCommissionRate" NUMERIC(5,4),
          "paymentMethod" payment_method NOT NULL DEFAULT 'manual',
          "referenceId" VARCHAR(128) UNIQUE,
          "callbackPayload" TEXT,
          status payment_status NOT NULL DEFAULT 'pending',
          "withdrawalRequestedAt" TIMESTAMP,
          "withdrawalCompletedAt" TIMESTAMP,
          "withdrawalReference" VARCHAR(128),
          notes TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

       // ============================================================
       // TRANSACTIONS
       // ============================================================

       await client.query(`
         CREATE TABLE IF NOT EXISTS transactions (
           id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
           "userId" INTEGER NOT NULL REFERENCES users(id),
           amount NUMERIC(12,2) NOT NULL,
           type VARCHAR(50) NOT NULL,
           status VARCHAR(50) NOT NULL DEFAULT 'pending',
           provider VARCHAR(100),
           "referenceId" VARCHAR(128),
           description TEXT,
           "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
           "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
         );
      `);

      // ============================================================
      // 19. PLATFORM WALLET
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS platform_wallet (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "totalCommissionEarned" NUMERIC(14,2) NOT NULL DEFAULT '0.00',
          "availableBalance" NUMERIC(14,2) NOT NULL DEFAULT '0.00',
          "totalWithdrawn" NUMERIC(14,2) NOT NULL DEFAULT '0.00',
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 20. PROVIDER WALLETS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS provider_wallets (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "providerId" INTEGER NOT NULL UNIQUE REFERENCES users(id),
          "providerRole" provider_role NOT NULL,
          "availableBalance" NUMERIC(12,2) NOT NULL DEFAULT '0.00',
          "totalEarned" NUMERIC(12,2) NOT NULL DEFAULT '0.00',
          "totalWithdrawn" NUMERIC(12,2) NOT NULL DEFAULT '0.00',
          "pendingBalance" NUMERIC(12,2) NOT NULL DEFAULT '0.00',
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 21. WITHDRAWAL REQUESTS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS withdrawal_requests (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "providerId" INTEGER NOT NULL,
          "providerRole" provider_role NOT NULL,
          amount NUMERIC(12,2) NOT NULL,
          "withdrawalMethod" payment_method NOT NULL,
          "accountNumber" VARCHAR(64) NOT NULL,
          "accountName" VARCHAR(255),
          status withdrawal_status NOT NULL DEFAULT 'pending',
          "reviewedBy" VARCHAR(128),
          "reviewedAt" TIMESTAMP,
          "adminNotes" TEXT,
          "withdrawalReference" VARCHAR(128),
          "mtnDisbursementAccepted" BOOLEAN DEFAULT FALSE,
          "requestedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "completedAt" TIMESTAMP,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 22. COMMISSION RULES
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS commission_rules (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "serviceType" VARCHAR(50) NOT NULL UNIQUE,
          rate NUMERIC(5,4) NOT NULL DEFAULT '0.1000',
          "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
          description TEXT,
          "createdBy" VARCHAR(128) NOT NULL DEFAULT 'system',
          "updatedBy" VARCHAR(128) NOT NULL DEFAULT 'system',
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 23. COMMISSION AUDIT LOG
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS commission_audit_log (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "serviceType" VARCHAR(50) NOT NULL,
          "oldRate" NUMERIC(5,4) NOT NULL,
          "newRate" NUMERIC(5,4) NOT NULL,
          "changedBy" VARCHAR(128) NOT NULL,
          reason TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 24. DRIVER STATUS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS driver_status (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "driverId" INTEGER NOT NULL UNIQUE REFERENCES driver_profiles(id),
          "driverName" VARCHAR(255),
          "zoneId" INTEGER REFERENCES zones(id),
          latitude NUMERIC(10,8) NOT NULL,
          longitude NUMERIC(11,8) NOT NULL,
          "isOnline" BOOLEAN NOT NULL DEFAULT FALSE,
          "activePickupId" VARCHAR(128),
          "headingDegrees" NUMERIC(6,2),
          "speedKmh" NUMERIC(6,2),
          "lastUpdated" TIMESTAMP NOT NULL DEFAULT NOW(),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 25. USER NOTIFICATIONS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS user_notifications (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "userId" INTEGER NOT NULL REFERENCES users(id),
          type notification_type NOT NULL,
          title VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
          data TEXT,
          "pickupId" VARCHAR(128),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 26. ZONE MANAGERS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS zone_managers (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "userId" INTEGER NOT NULL UNIQUE REFERENCES users(id),
          "zoneId" INTEGER NOT NULL REFERENCES zones(id),
          status zone_status NOT NULL DEFAULT 'active',
          "commissionRate" NUMERIC(5,2) NOT NULL DEFAULT '10.00',
          "assignedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "unassignedAt" TIMESTAMP,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 27. ZONE MANAGER DRIVERS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS zone_manager_drivers (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "zoneManagerId" INTEGER NOT NULL REFERENCES zone_managers(id),
          "driverId" INTEGER NOT NULL REFERENCES driver_profiles(id),
          status zone_status NOT NULL DEFAULT 'active',
          "assignedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "unassignedAt" TIMESTAMP,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 28. CUSTOMER ZONE ASSIGNMENTS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS customer_zone_assignments (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "userId" INTEGER NOT NULL UNIQUE REFERENCES users(id),
          "zoneId" INTEGER NOT NULL REFERENCES zones(id),
          address TEXT NOT NULL,
          latitude NUMERIC(10,8) NOT NULL,
          longitude NUMERIC(11,8) NOT NULL,
          "assignedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 29. GARBAGE PICKUPS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS garbage_pickups (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "customerId" INTEGER NOT NULL REFERENCES users(id),
          "zoneId" INTEGER NOT NULL REFERENCES zones(id),
          "zoneManagerId" INTEGER REFERENCES zone_managers(id),
          "driverId" INTEGER REFERENCES driver_profiles(id),
          address TEXT NOT NULL,
          latitude NUMERIC(10,8) NOT NULL,
          longitude NUMERIC(11,8) NOT NULL,
          status pickup_status NOT NULL DEFAULT 'pending',
          notes TEXT,
          "scheduledTime" TIMESTAMP,
          "acceptedAt" TIMESTAMP,
          "assignedAt" TIMESTAMP,
          "arrivedAt" TIMESTAMP,
          "completedAt" TIMESTAMP,
          "cancelledAt" TIMESTAMP,
          "cancellationReason" TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 30. PICKUP ASSIGNMENTS
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS pickup_assignments (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "pickupId" INTEGER NOT NULL REFERENCES garbage_pickups(id),
          "driverId" INTEGER NOT NULL REFERENCES driver_profiles(id),
          "assignedBy" INTEGER REFERENCES zone_managers(id),
          status pickup_status NOT NULL DEFAULT 'pending',
          "acceptedAt" TIMESTAMP,
          "assignedAt" TIMESTAMP,
          "completedAt" TIMESTAMP,
          "cancelledAt" TIMESTAMP,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 31. ZONE GEOMETRIES
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS zone_geometries (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "zoneId" INTEGER NOT NULL UNIQUE REFERENCES zones(id),
          "geometryType" geometry_type NOT NULL DEFAULT 'polygon',
          coordinates TEXT NOT NULL,
          "centerLat" NUMERIC(10,8),
          "centerLng" NUMERIC(11,8),
          "radiusMeters" INTEGER,
          "createdBy" INTEGER NOT NULL REFERENCES users(id),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 32. ZONE ADMIN PROFILES
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS zone_admin_profiles (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "userId" INTEGER NOT NULL UNIQUE REFERENCES users(id),
          "fullName" VARCHAR(255) NOT NULL,
          phone VARCHAR(20) NOT NULL,
          email VARCHAR(320),
          "isApproved" BOOLEAN NOT NULL DEFAULT FALSE,
          "approvedAt" TIMESTAMP,
          "approvedBy" INTEGER REFERENCES users(id),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 33. ZONE ADMIN ZONES
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS zone_admin_zones (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "zoneAdminId" INTEGER NOT NULL REFERENCES zone_admin_profiles(id),
          "zoneId" INTEGER NOT NULL REFERENCES zones(id),
          "createdBy" INTEGER NOT NULL REFERENCES users(id),
          "assignedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // ============================================================
      // 34. ZONE AUDIT LOG
      // ============================================================

      await client.query(`
        CREATE TABLE IF NOT EXISTS zone_audit_log (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "zoneId" INTEGER NOT NULL REFERENCES zones(id),
          action audit_action NOT NULL,
          "createdBy" INTEGER NOT NULL REFERENCES users(id),
          details TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      log("INFO", "Operational Railway tables initialized");
    log("INFO", "Database initialized successfully");
  } finally { client.release(); }
}

interface User { id: string; name?: string | null; phoneNumber: string; country: string; province?: string | null; city?: string | null; town?: string | null; fullAddress?: string | null; createdAt: string; }
interface Wallet { id: string; userId: string; balance: string; updatedAt: string; }
interface Transaction { id: string; userId: string; depositId: string; amount: string; type: string; status: string; provider: string | null; phoneNumber: string | null; createdAt: string; updatedAt: string; }
interface LinkedAccount { id: string; userId: string; phoneNumber: string; provider: string; withdrawalPin: string; isActive: number; createdAt: string; updatedAt: string; }
type PickupStatus = "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
interface Pickup { id: string; userId: string; userName: string | null; userPhone: string | null; location: string | null; latitude: number | null; longitude: number | null; wasteType: string; notes: string | null; status: PickupStatus; zoneId: string | null; scheduledDate: string | null; scheduledTime: string | null; assignedTo: string | null; completedAt: string | null; createdAt: string; updatedAt: string; }

function now(): string { return new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); }

async function getOrCreateUser(
  phoneNumber: string,
  opts?: {
    name?: string;
    country?: string;
    province?: string;
    city?: string;
    town?: string;
    fullAddress?: string;
  }
): Promise<User> {

  const existing = await pool.query<User>(
    `SELECT * FROM ltc_users WHERE "phoneNumber" = $1`,
    [phoneNumber]
  );

  // User already exists
   // Update missing information
    if (existing.rows[0]) {
  const updated = await pool.query<User>(
    `UPDATE ltc_users
     SET
       name = COALESCE(NULLIF($1, ''), name),
       country = COALESCE(NULLIF($2, ''), country),
       province = COALESCE(NULLIF($3, ''), province),
       city = COALESCE(NULLIF($4, ''), city),
       town = COALESCE(NULLIF($5, ''), town),
       "fullAddress" = COALESCE(NULLIF($6, ''), "fullAddress")
     WHERE "phoneNumber" = $7
     RETURNING *`,
    [
      opts?.name ?? null,
      opts?.country ?? null,
      opts?.province ?? null,
      opts?.city ?? null,
      opts?.town ?? null,
      opts?.fullAddress ?? null,
      phoneNumber,
    ]
  );

  return updated.rows[0];
}

  // Create new user
  const userId = `user_${uuidv4()
    .replace(/-/g, "")
    .substring(0, 12)}`;

  await pool.query(
    `INSERT INTO ltc_users
      (
        id,
        name,
        "phoneNumber",
        country,
        province,
        city,
        town,
        "fullAddress",
        "createdAt"
      )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      userId,
      opts?.name ?? null,
      phoneNumber,
      opts?.country ?? "ZMB",
      opts?.province ?? null,
      opts?.city ?? null,
      opts?.town ?? null,
      opts?.fullAddress ?? null,
      now(),
    ]
  );

  const result = await pool.query<User>(
    `SELECT * FROM ltc_users WHERE id = $1`,
    [userId]
  );

  return result.rows[0];
}

async function getUserById(userId: string): Promise<User | undefined> {
  const result = await pool.query<User>(`SELECT * FROM ltc_users WHERE id = $1`, [userId]);
  return result.rows[0];
}

async function getOrCreateOperationalUser(
  ltcUser: User
): Promise<number> {
  const openId = `ltc_${ltcUser.id}`;

  const result = await pool.query<{ id: number }>(
    `
    INSERT INTO users (
      "openId",
      "ltcUserId",
      name,
      phone,
      role,
      "updatedAt",
      "lastSignedIn"
    )
    VALUES ($1, $2, $3, $4, 'user', NOW(), NOW())
    ON CONFLICT ("openId")
    DO UPDATE SET
      "ltcUserId" = EXCLUDED."ltcUserId",
      name = COALESCE(EXCLUDED.name, users.name),
      phone = COALESCE(EXCLUDED.phone, users.phone),
      "updatedAt" = NOW(),
      "lastSignedIn" = NOW()
    RETURNING id
    `,
    [
      openId,
      ltcUser.id,
      ltcUser.name ?? ltcUser.phoneNumber,
      ltcUser.phoneNumber,
    ]
  );

  return result.rows[0].id;
}

async function getOrCreateCustomerWallet(
  operationalUserId: number
): Promise<void> {
  await pool.query(
    `
    INSERT INTO customer_wallets (
      "userId",
      "totalBalance",
      "rechargedBalance",
      "referralBalance"
    )
    VALUES ($1, 0, 0, 0)
    ON CONFLICT ("userId")
    DO NOTHING
    `,
    [operationalUserId]
  );
}

async function getOrCreateWallet(userId: string): Promise<Wallet> {
  const existing = await pool.query<Wallet>(`SELECT * FROM ltc_wallets WHERE "userId" = $1`, [userId]);
  if (existing.rows[0]) return existing.rows[0];
  const walletId = `wallet_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  await pool.query(`INSERT INTO ltc_wallets (id, "userId", balance, "updatedAt") VALUES ($1,$2,0,$3)`, [walletId, userId, now()]);
  const result = await pool.query<Wallet>(`SELECT * FROM ltc_wallets WHERE id = $1`, [walletId]);
  return result.rows[0];
}

async function getWalletByUserId(userId: string): Promise<Wallet | undefined> {
  const result = await pool.query<Wallet>(`SELECT * FROM ltc_wallets WHERE "userId" = $1`, [userId]);
  return result.rows[0];
}

async function updateWalletBalance(userId: string, delta: number): Promise<void> {
  await pool.query(`UPDATE ltc_wallets SET balance = balance + $1, "updatedAt" = $2 WHERE "userId" = $3`, [delta, now(), userId]);
}

async function createTransaction(userId: string, depositId: string, amount: number, type: "deposit" | "withdrawal", provider?: string, phoneNumber?: string): Promise<Transaction> {
  const txnId = `txn_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  const n = now();
  await pool.query(`INSERT INTO ltc_transactions (id, "userId", "depositId", amount, type, status, provider, "phoneNumber", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9)`,
    [txnId, userId, depositId, amount, type, provider ?? null, phoneNumber ?? null, n, n]);
  const result = await pool.query<Transaction>(`SELECT * FROM ltc_transactions WHERE id = $1`, [txnId]);
  return result.rows[0];
}

async function getTransactionByDepositId(depositId: string): Promise<Transaction | undefined> {
  const result = await pool.query<Transaction>(`SELECT * FROM ltc_transactions WHERE "depositId" = $1`, [depositId]);
  return result.rows[0];
}

async function updateTransactionStatus(depositId: string, status: string): Promise<void> {
  await pool.query(`UPDATE ltc_transactions SET status = $1, "updatedAt" = $2 WHERE "depositId" = $3`, [status, now(), depositId]);
}

async function failWithdrawalTransaction(
  depositId: string
): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<Transaction>(
      `
      SELECT *
      FROM ltc_transactions
      WHERE "depositId" = $1
      FOR UPDATE
      `,
      [depositId]
    );

    const transaction = result.rows[0];

    if (!transaction) {
      await client.query("ROLLBACK");
      return false;
    }

    if (
      transaction.type !== "withdrawal" ||
      transaction.status === "failed" ||
      transaction.status === "completed"
    ) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `
      UPDATE ltc_wallets
      SET
        balance = balance + $1,
        "updatedAt" = $2
      WHERE "userId" = $3
      `,
      [
        Math.abs(Number(transaction.amount)),
        now(),
        transaction.userId,
      ]
    );

    await client.query(
      `
      UPDATE ltc_transactions
      SET
        status = 'failed',
        "updatedAt" = $1
      WHERE "depositId" = $2
      `,
      [now(), depositId]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function completeDepositTransaction(
  depositId: string,
  amount: number
): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<Transaction>(
      `
      SELECT *
      FROM ltc_transactions
      WHERE "depositId" = $1
      FOR UPDATE
      `,
      [depositId]
    );

    const transaction = result.rows[0];

    if (!transaction || transaction.status === "completed") {
      await client.query("ROLLBACK");
      return false;
    }

    if (transaction.type !== "deposit") {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `
      UPDATE ltc_wallets
      SET
        balance = balance + $1,
        "updatedAt" = $2
      WHERE "userId" = $3
      `,
      [amount, now(), transaction.userId]
    );

    const operationalUser = await client.query<{ id: number }>(
      `
      SELECT id
      FROM users
      WHERE "ltcUserId" = $1
      `,
      [transaction.userId]
    );

    if (operationalUser.rows[0]) {
      await client.query(
        `
        INSERT INTO customer_wallets (
          "userId",
          "totalBalance",
          "rechargedBalance",
          "referralBalance"
        )
        VALUES ($1, 0, 0, 0)
        ON CONFLICT ("userId") DO NOTHING
        `,
        [operationalUser.rows[0].id]
      );

      await client.query(
        `
        UPDATE customer_wallets
        SET
          "totalBalance" = "totalBalance" + $1,
          "rechargedBalance" = "rechargedBalance" + $1,
          "updatedAt" = NOW()
        WHERE "userId" = $2
        `,
        [amount, operationalUser.rows[0].id]
      );
    }

    await client.query(
      `
      UPDATE ltc_transactions
      SET
        status = 'completed',
        "updatedAt" = $1
      WHERE "depositId" = $2
      `,
      [now(), depositId]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors
    }

    throw error;
  } finally {
    client.release();
  }
}

async function getTransactionsByUserId(userId: string): Promise<Transaction[]> {
  const result = await pool.query<Transaction>(`SELECT * FROM ltc_transactions WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId]);
  return result.rows;
}

async function getLinkedAccount(userId: string): Promise<LinkedAccount | undefined> {
  const result = await pool.query<LinkedAccount>(`SELECT * FROM ltc_linked_accounts WHERE "userId" = $1 AND "isActive" = 1`, [userId]);
  return result.rows[0];
}

async function linkAccount(
  userId: string,
  phoneNumber: string,
  provider: string,
  withdrawalPin: string
): Promise<LinkedAccount> {
  const accountId = `linked_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  const n = now();
  const hashedWithdrawalPin = await bcrypt.hash(withdrawalPin, 12);
    await pool.query(
    `
    INSERT INTO ltc_linked_accounts (
      id,
      "userId",
      "phoneNumber",
      provider,
      "withdrawalPin",
      "isActive",
      "createdAt",
      "updatedAt"
    )
    VALUES ($1, $2, $3, $4, $5, 1, $6, $7)
    ON CONFLICT ("userId")
    DO UPDATE SET
      "phoneNumber" = EXCLUDED."phoneNumber",
      provider = EXCLUDED.provider,
      "withdrawalPin" = EXCLUDED."withdrawalPin",
      "isActive" = 1,
      "updatedAt" = EXCLUDED."updatedAt"
    `,
    [
      accountId,
      userId,
      phoneNumber,
      provider,
      hashedWithdrawalPin,
      n,
      n,
    ]
  );

  const result = await pool.query<LinkedAccount>(
    `
    SELECT *
    FROM ltc_linked_accounts
    WHERE "userId" = $1
      AND "isActive" = 1
    `,
    [userId]
  );
  return result.rows[0];
}

async function unlinkAccount(userId: string): Promise<void> {
  await pool.query(`UPDATE ltc_linked_accounts SET "isActive" = 0, "updatedAt" = $1 WHERE "userId" = $2`, [now(), userId]);
}

function isValidMobilePhone(phone: unknown): phone is string {
  if (typeof phone !== "string") return false;

  const normalized = phone
    .replace(/\s+/g, "")
    .replace(/^\+/, "");

  return /^(260|255|0)\d{9}$/.test(normalized);
}

function detectZambiaNetwork(rawPhone: string): string {
  let phone = rawPhone.replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("260")) phone = "0" + phone.slice(3);
  if (!phone.startsWith("0")) phone = "0" + phone;
  const p3 = phone.substring(0, 3);

  if (p3 === "096" || p3 === "076") return "MTN_MOMO_ZMB";
  if (p3 === "097" || p3 === "077") return "AIRTEL_OAPI_ZMB";
  if (p3 === "095" || p3 === "075") return "ZAMTEL_ZMB";

  return "MTN_MOMO_ZMB";
}

function detectTanzaniaNetwork(rawPhone: string): string {
  let phone = rawPhone.replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("255")) phone = "0" + phone.slice(3);
  if (!phone.startsWith("0")) phone = "0" + phone;
  const p3 = phone.substring(0, 3);
  if (["074","075","076"].includes(p3)) return "VODACOM_TZ";
  if (p3 === "078") return "AIRTEL_TZ";
  if (p3 === "071" || p3 === "065") return "TIGO_TZ";
  return "VODACOM_TZ";
}

function detectNetwork(c: string, p: string): string { return c === "TZA" ? detectTanzaniaNetwork(p) : detectZambiaNetwork(p); }
function toE164(c: string, p: string): string {
  const phone = p.replace(/\s+/g, "").replace(/^\+/, "");
  if (c === "TZA") { if (phone.startsWith("255")) return phone; return phone.startsWith("0") ? "255" + phone.slice(1) : "255" + phone; }
  if (phone.startsWith("260")) return phone; return phone.startsWith("0") ? "260" + phone.slice(1) : "260" + phone;
}
function currencyForCountry(c: string): string { return c === "TZA" ? "TZS" : "ZMW"; }

interface PawaPayDepositRequest {
  depositId: string;
  payer: {
    type: "MMO";
    accountDetails: {
      phoneNumber: string;
      provider: string;
    };
  };
  amount: string;
  currency: string;
  statementDescription: string;
  clientReferenceId: string;
  callbackUrl: string;
  customerMessage?: string;
}
interface PawaPayDepositResponse { depositId: string; status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED"; created?: string; failureReason?: { failureCode: string; failureMessage: string }; }
interface PawaPayDepositStatusResponse {
  depositId: string;
  status:
    | "ACCEPTED"
    | "COMPLETED"
    | "FAILED"
    | "REJECTED"
    | "DUPLICATE_IGNORED";
  amount?: string;
  currency?: string;
  correspondent?: string;
  payer?: {
    type: string;
    accountDetails: {
      phoneNumber: string;
    };
  };
  created?: string;
  failureReason?: {
    failureCode: string;
    failureMessage: string;
  };
}
interface PawaPayPayoutRequest {
  payoutId: string;
  amount: string;
  currency: string;
  country: string;
  correspondent: string;
  recipient: {
    type: "MSISDN";
    address: {
      value: string;
    };
  };
  customerTimestamp: string;
  statementDescription?: string;
  clientReferenceId?: string;
  callbackUrl?: string;
}
interface PawaPayPayoutResponse { payoutId: string; status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED"; created?: string; failureReason?: { failureCode: string; failureMessage: string }; }
interface PawaPayPayoutStatusResponse {
  payoutId: string;
  status:
    | "ACCEPTED"
    | "COMPLETED"
    | "FAILED"
    | "REJECTED"
    | "DUPLICATE_IGNORED";
  amount?: string;
  currency?: string;
  correspondent?: string;
  created?: string;
  failureReason?: {
    failureCode: string;
    failureMessage: string;
  };
}
const pawaPayHeaders = () => ({ Authorization: `Bearer ${process.env.PAWAPAY_PAYOUT_TOKEN || process.env.PAWAPAY_TOKEN || process.env.PAWAPAY_API_KEY}`, "Content-Type": "application/json" });

async function initiatePawaPayDeposit(
  params: PawaPayDepositRequest
): Promise<PawaPayDepositResponse> {
  console.log("PawaPay deposit payload:", JSON.stringify(params, null, 2));

  try {
    const r = await axios.post<PawaPayDepositResponse>(
      `${PAWAPAY_BASE_URL}/v2/deposits`,
      params,
      {
        headers: pawaPayHeaders(),
        timeout: 30_000,
      }
    );

    console.log("PawaPay deposit response:", {
      status: r.status,
      data: r.data,
    });

    return r.data;
    } catch (error: any) {
    console.error("PawaPay deposit request failed:", {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
      url: error?.config?.url,
      method: error?.config?.method,
    });

    throw error;
  }
}
 
async function fetchPawaPayDepositStatus(
  depositId: string
): Promise<PawaPayDepositStatusResponse | null> {
  try {
    const response =
      await axios.get<PawaPayDepositStatusResponse>(
        `${PAWAPAY_BASE_URL}/v1/deposits/${depositId}`,
        {
          headers: pawaPayHeaders(),
          timeout: 15_000,
        }
      );

    return response.data;
  } catch (error: any) {
    console.error("Unable to verify deposit with PawaPay:", {
      depositId,
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    });

    return null;
  }
}

async function fetchPawaPayPayoutStatus(
  payoutId: string
): Promise<PawaPayPayoutStatusResponse | null> {
  try {
    const response =
      await axios.get<PawaPayPayoutStatusResponse>(
        `${PAWAPAY_BASE_URL}/v1/payouts/${payoutId}`,
        {
          headers: pawaPayHeaders(),
          timeout: 15_000,
        }
      );

    return response.data;
  } catch (error: any) {
    console.error("Unable to verify payout with PawaPay:", {
      payoutId,
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    });

    return null;
  }
}

async function initiatePawaPayPayout(
  params: PawaPayPayoutRequest
): Promise<PawaPayPayoutResponse> {
  const payload = {
    payoutId: params.payoutId,
    amount: params.amount,
    currency: params.currency,
    country: params.country,
    correspondent: params.correspondent,
    recipient: params.recipient,
    customerTimestamp: params.customerTimestamp,
    statementDescription: params.statementDescription,
    clientReferenceId: params.clientReferenceId,
    callbackUrl: params.callbackUrl,
  };

  console.log(
    "PawaPay payout payload:",
    JSON.stringify(payload, null, 2)
  );

  const r = await axios.post<PawaPayPayoutResponse>(
    `${PAWAPAY_BASE_URL}/v1/payouts`,
    payload,
    {
      headers: pawaPayHeaders(),
      timeout: 30_000,
    }
  );

  console.log("PawaPay payout response:", {
    status: r.status,
    data: r.data,
  });

  return r.data;
}

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.raw({ type: "application/octet-stream", limit: "10mb" }));

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ??
  "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim());

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Digest"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use((req: Request, _res: Response, next: NextFunction) => {
  log("INFO", `${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true, env: NODE_ENV, pawapay: PAWAPAY_API_KEY ? "configured" : "missing", timestamp: new Date().toISOString() }));

app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const {
      phoneNumber,
      name,
      country,
      province,
      city,
      town,
      fullAddress,
    } = req.body;

    if (!isValidMobilePhone(phoneNumber)) {
  return res.status(400).json({
    success: false,
    message: "Invalid phone number",
    errorCode: "INVALID_PHONE",
  });
}

    console.log("Creating user:", {
      phoneNumber,
      name,
      country,
      province,
      city,
    });

    const user = await getOrCreateUser(phoneNumber, {
     name,
     country,
     province,
     city,
     town,
     fullAddress,
   });

    await getOrCreateWallet(user.id);

    const operationalUserId = await getOrCreateOperationalUser(user);
    await getOrCreateCustomerWallet(operationalUserId);

    return res.status(200).json({
     success: true,
     data: {
      userId: user.id,
      operationalUserId,
      phoneNumber: user.phoneNumber,
      name: user.name,
      country: user.country,
      province: user.province,
      city: user.city,
      isNew: false,
     },
   });
  } catch (error) {
    console.error("POST /api/users error:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Internal server error",
    });
  }
});

app.get("/api/users/:userId", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params["userId"]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, data: user });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.post("/api/payments/pawapay", async (req: Request, res: Response) => {
  const { amount, phoneNumber, userId: bodyUserId, country: bodyCountry } = req.body;
  const countryCode = bodyCountry ?? (phoneNumber?.replace(/^\+/, "").startsWith("255") ? "TZA" : "ZMB");
  try {
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "Invalid amount", errorCode: "INVALID_AMOUNT" });
    if (!phoneNumber) return res.status(400).json({ success: false, message: "Missing phoneNumber", errorCode: "MISSING_PHONE" });
    const user = bodyUserId ? ((await getUserById(bodyUserId)) ?? (await getOrCreateUser(phoneNumber, { country: countryCode }))) : await getOrCreateUser(phoneNumber, { country: countryCode });
    await getOrCreateWallet(user.id);
    const operationalUserId = await getOrCreateOperationalUser(user);
    await getOrCreateCustomerWallet(operationalUserId);
    const e164Phone = toE164(countryCode, phoneNumber);
    const correspondent = detectNetwork(countryCode, phoneNumber);
    const currency = currencyForCountry(countryCode);
   const depositId = uuidv4();

const displayDepositId = `LTC-DEP-${Date.now()}-${Math.floor(
  Math.random() * 9999
)}`;

// Create the local transaction BEFORE calling PawaPay.
// This prevents a callback race condition.
const transaction = await createTransaction(
  user.id,
  depositId,
  Number(amount),
  "deposit",
  correspondent,
  e164Phone
);

let pawaPayResponse: PawaPayDepositResponse;

try {
  pawaPayResponse = await initiatePawaPayDeposit({
    depositId,
    payer: {
      type: "MMO",
      accountDetails: {
        phoneNumber: e164Phone,
        provider: correspondent,
      },
    },
    amount: String(Number(amount).toFixed(2)),
    currency,
    statementDescription: "LTC deposit",
    customerMessage: "LTC deposit",
    clientReferenceId: user.id,
    callbackUrl: `${CALLBACK_BASE_URL}/api/payments/pawapay/callback`,
  });
} catch (error) {
  await updateTransactionStatus(depositId, "failed");
  throw error;
}

if (pawaPayResponse.status === "REJECTED") {
  await updateTransactionStatus(depositId, "failed");

  return res.status(422).json({
    success: false,
    message:
      pawaPayResponse.failureReason?.failureMessage ??
      "Payment rejected",
    errorCode:
      pawaPayResponse.failureReason?.failureCode ?? "REJECTED",
  });
}
    return res.status(201).json({ success: true, data: { depositId, displayDepositId, providerDepositId: depositId, status: pawaPayResponse.status, amount: Number(amount), phoneNumber: e164Phone, provider: correspondent, userId: user.id, transactionId: transaction.id, createdAt: pawaPayResponse.created ?? new Date().toISOString() }, timestamp: new Date().toISOString() });
   } catch (error: any) {
    console.error("POST /api/payments/pawapay failed:", {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      stack: error?.stack,
    });

    if (axios.isAxiosError(error)) {
      return res.status(error.response?.status ?? 502).json({
        success: false,
        message:
          error.response?.data?.message ??
          error.response?.data?.failureReason?.failureMessage ??
          "PawaPay deposit request failed",
        errorCode:
          error.response?.data?.errorCode ??
          error.response?.data?.failureReason?.failureCode ??
          "PAWAPAY_ERROR",
        details: error.response?.data ?? null,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Internal server error",
    });
  }
});

app.get(
  "/api/payments/:depositId/status",
  async (req: Request, res: Response) => {
    try {
      const depositId = req.params["depositId"];
      const verify = req.query["verify"] === "true";

      const transaction = await getTransactionByDepositId(depositId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found",
        });
      }

      let liveStatus: string | undefined;

      if (verify) {
        const liveData =
  transaction.type === "withdrawal"
    ? await fetchPawaPayPayoutStatus(depositId)
    : await fetchPawaPayDepositStatus(depositId);

        if (liveData) {
  liveStatus = liveData.status;

  if (transaction.type === "deposit") {
    if (liveData.status === "COMPLETED") {
      await completeDepositTransaction(
        depositId,
        Number(liveData.amount ?? transaction.amount)
      );
    } else if (
      liveData.status === "FAILED" ||
      liveData.status === "REJECTED"
    ) {
      await updateTransactionStatus(
        depositId,
        "failed"
      );
    } else if (liveData.status === "ACCEPTED") {
      await updateTransactionStatus(
        depositId,
        "processing"
      );
    }
  } else if (transaction.type === "withdrawal") {
    if (
      liveData.status === "FAILED" ||
      liveData.status === "REJECTED"
    ) {
      await failWithdrawalTransaction(depositId);
    } else if (liveData.status === "COMPLETED") {
      await updateTransactionStatus(
        depositId,
        "completed"
      );
    } else if (liveData.status === "ACCEPTED") {
      await updateTransactionStatus(
        depositId,
        "processing"
      );
    }
  }
}

      const updated =
        (await getTransactionByDepositId(depositId)) ?? transaction;

      return res.json({
        success: true,
        data: {
          depositId: updated.depositId,
          transactionId: updated.id,
          userId: updated.userId,
          amount: updated.amount,
          status: updated.status,
          provider: updated.provider,
          phoneNumber: updated.phoneNumber,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          ...(liveStatus ? { liveStatus } : {}),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Internal server error",
      });
    }
  }
);

app.post(
  "/api/payments/pawapay/callback",
  async (req: Request, res: Response) => {
    try {
      const payload = Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString())
        : req.body;

      const referenceId = (
        payload["depositId"] ||
        payload["payoutId"] ||
        payload["refundId"]
      ) as string;

      const callbackStatus = payload["status"] as string;

      if (!referenceId || !callbackStatus) {
        return res.status(400).json({
          success: false,
          message: "Missing referenceId or status",
        });
      }

      const transaction =
        await getTransactionByDepositId(referenceId);

      if (!transaction) {
        console.error(
          "Callback received before transaction existed:",
          {
            referenceId,
            payload,
          }
        );

        return res.json({
          success: true,
          data: {
            received: true,
            referenceId,
            transactionFound: false,
          },
        });
      }

      if (
        transaction.status === "completed" ||
        transaction.status === "failed"
      ) {
        return res.json({
          success: true,
          data: {
            received: true,
            referenceId,
            alreadyProcessed: true,
          },
        });
      }

      // Deposit: verify directly with PawaPay.
      if (transaction.type === "deposit") {
        const verifiedPayment =
          await fetchPawaPayDepositStatus(referenceId);

        if (!verifiedPayment) {
          return res.status(503).json({
            success: false,
            message: "Unable to verify payment with PawaPay",
          });
        }
                if (verifiedPayment.status === "COMPLETED") {
          await completeDepositTransaction(
            referenceId,
            Number(verifiedPayment.amount ?? transaction.amount)
          );
        } else if (
          verifiedPayment.status === "FAILED" ||
          verifiedPayment.status === "REJECTED"
        ) {
          await updateTransactionStatus(
            referenceId,
            "failed"
          );
        } else if (
          verifiedPayment.status === "ACCEPTED"
        ) {
          await updateTransactionStatus(
            referenceId,
            "processing"
          );
        }
        return res.json({
          success: true,
          data: {
            received: true,
            referenceId,
            callbackStatus,
            verifiedStatus: verifiedPayment.status,
          },
        });
      }

      // Withdrawal: verify directly with PawaPay.
      if (transaction.type === "withdrawal") {
        const verifiedPayout =
          await fetchPawaPayPayoutStatus(referenceId);

        if (!verifiedPayout) {
          return res.status(503).json({
            success: false,
            message: "Unable to verify payout with PawaPay",
          });
        }

        if (
          verifiedPayout.status === "FAILED" ||
          verifiedPayout.status === "REJECTED"
        ) {
          await failWithdrawalTransaction(referenceId);
        } else if (
          verifiedPayout.status === "COMPLETED"
        ) {
          await updateTransactionStatus(
            referenceId,
            "completed"
          );
        } else if (
          verifiedPayout.status === "ACCEPTED"
        ) {
          await updateTransactionStatus(
            referenceId,
            "processing"
          );
        }

        return res.json({
          success: true,
          data: {
            received: true,
            referenceId,
            callbackStatus,
            verifiedStatus: verifiedPayout.status,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          received: true,
          referenceId,
          message: "Transaction type not processed",
        },
      });
    } catch (error) {
      console.error("PawaPay callback error:", error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Callback processing failed",
      });
    }
  }
);

app.get("/api/wallet/:userId", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params["userId"]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const wallet = await getOrCreateWallet(req.params["userId"]);
    return res.json({ success: true, data: { walletId: wallet.id, userId: wallet.userId, balance: Number(wallet.balance), totalBalance: Number(wallet.balance), phoneNumber: user.phoneNumber, updatedAt: wallet.updatedAt } });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.get("/api/transactions/:userId", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params["userId"]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const transactions = await getTransactionsByUserId(req.params["userId"]);
    return res.json({ success: true, data: { userId: req.params["userId"], phoneNumber: user.phoneNumber, transactions, total: transactions.length, totalAmount: transactions.reduce((s, t) => s + Number(t.amount), 0), completedAmount: transactions.filter(t => t.status === "completed").reduce((s, t) => s + Number(t.amount), 0) } });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

function normalizeProvider(provider: string): string {
  const value = provider.toLowerCase();

  if (value.includes("mtn")) return "mtn_momo";
  if (value.includes("airtel")) return "airtel_money";
  if (value.includes("zamtel")) return "zamtel_money";

  return value;
}

app.post("/api/linked-accounts/:userId/link", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, provider, withdrawalPin } = req.body;

    if (!phoneNumber || phoneNumber.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
      });
    }

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "Provider required",
      });
    }

    if (!withdrawalPin || withdrawalPin.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Invalid PIN",
      });
    }

    const normalizedProvider = normalizeProvider(provider);

    if (
      !["mtn_momo", "airtel_money", "zamtel_money"].includes(
        normalizedProvider
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider",
      });
    }

    const user = await getUserById(req.params["userId"]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const linked = await linkAccount(
      req.params["userId"],
      phoneNumber,
      normalizedProvider,
      withdrawalPin
    );

    const operationalUserId = await getOrCreateOperationalUser(user);
    await getOrCreateCustomerWallet(operationalUserId);

    await pool.query(
      `
      INSERT INTO linked_accounts (
        "userId",
        "phoneNumber",
        provider,
        "isActive",
        "updatedAt"
      )
      VALUES ($1, $2, $3::provider_enum, TRUE, NOW())
      ON CONFLICT ("userId")
      DO UPDATE SET
        "phoneNumber" = EXCLUDED."phoneNumber",
        provider = EXCLUDED.provider,
        "isActive" = TRUE,
        "updatedAt" = NOW()
      `,
      [operationalUserId, phoneNumber, normalizedProvider]
    );

    return res.status(201).json({
      success: true,
      data: {
        id: linked.id,
        phoneNumber: linked.phoneNumber,
        provider: linked.provider,
        isActive: linked.isActive === 1,
        createdAt: linked.createdAt,
      },
    });
  } catch (error) {
    console.error("Link account error:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Internal server error",
    });
  }
});

app.get("/api/linked-accounts/:userId", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params["userId"]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const linked = await getLinkedAccount(req.params["userId"]);
    return res.json({ success: true, data: linked ? { id: linked.id, phoneNumber: linked.phoneNumber, provider: linked.provider, isActive: linked.isActive === 1, createdAt: linked.createdAt } : null });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.post("/api/linked-accounts/:userId/unlink", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params["userId"]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    await unlinkAccount(req.params["userId"]);
    return res.json({ success: true, data: { unlinked: true } });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.post("/api/withdrawals", async (req: Request, res: Response) => {
  const { userId, amount, withdrawalPin } = req.body;

  try {
    if (!userId || !amount || !withdrawalPin) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const withdrawalAmount = Number(amount);

    if (!Number.isFinite(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero",
      });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const wallet = await getWalletByUserId(userId);

    if (!wallet) {
      return res.status(400).json({
        success: false,
        message: "Wallet not found",
      });
    }

    const linked = await getLinkedAccount(userId);

    if (!linked) {
      return res.status(400).json({
        success: false,
        message: "No linked account found",
      });
    }

    const validWithdrawalPin = await bcrypt.compare(
      String(withdrawalPin),
      linked.withdrawalPin
    );

    if (!validWithdrawalPin) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal PIN",
      });
    }

    const payoutId = uuidv4();
    const displayWithdrawalId = `LTC-WD-${Date.now()}-${Math.floor(
      Math.random() * 9999
    )}`;

    const userCountry = user.country ?? "ZMB";
    const e164Phone = toE164(userCountry, linked.phoneNumber);
    const correspondent = detectNetwork(
      userCountry,
      linked.phoneNumber
    );
    const currency = currencyForCountry(userCountry);

    // Deduct/reserve funds atomically.
    const deducted = await pool.query(
      `
      UPDATE ltc_wallets
      SET
        balance = balance - $1,
        "updatedAt" = $2
      WHERE "userId" = $3
        AND balance >= $1
      RETURNING balance
      `,
      [withdrawalAmount, now(), userId]
    );

    if (!deducted.rows[0]) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // Create the transaction before calling PawaPay.
    const transaction = await createTransaction(
      userId,
      payoutId,
      -withdrawalAmount,
      "withdrawal",
      correspondent,
      e164Phone
    );

    await updateTransactionStatus(payoutId, "processing");

    let pawaPayResponse: PawaPayPayoutResponse;

    try {
      pawaPayResponse = await initiatePawaPayPayout({
        payoutId,
        amount: withdrawalAmount.toFixed(2),
        currency,
        country: userCountry,
        correspondent,
        recipient: {
          type: "MSISDN",
          address: {
            value: e164Phone,
          },
        },
        customerTimestamp: new Date().toISOString(),
        statementDescription: "LTC withdrawal",
        clientReferenceId: userId,
        callbackUrl: `${CALLBACK_BASE_URL}/api/payments/pawapay/callback`,
      });
    } catch (error) {
      await updateWalletBalance(userId, withdrawalAmount);
      await updateTransactionStatus(payoutId, "failed");
      throw error;
    }

    if (pawaPayResponse.status === "REJECTED") {
      await updateWalletBalance(userId, withdrawalAmount);
      await updateTransactionStatus(payoutId, "failed");

      return res.status(422).json({
        success: false,
        message:
          pawaPayResponse.failureReason?.failureMessage ??
          "Withdrawal rejected",
        errorCode:
          pawaPayResponse.failureReason?.failureCode ?? "REJECTED",
      });
    }

    return res.json({
      success: true,
      data: {
        withdrawalId: displayWithdrawalId,
        providerWithdrawalId: payoutId,
        transactionId: transaction.id,
        status: "PROCESSING",
        amount: withdrawalAmount,
        phoneNumber: e164Phone,
        provider: correspondent,
        createdAt:
          pawaPayResponse.created ?? new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Withdrawal endpoint failed:", {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      stack: error?.stack,
    });

    if (axios.isAxiosError(error)) {
      return res.status(400).json({
        success: false,
        message: "PawaPay error",
        details: error.response?.data ?? null,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

const VALID_STATUSES: PickupStatus[] = ["pending", "accepted", "in_progress", "completed", "cancelled"];

app.get("/api/pickups", async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.query["userId"]) ? req.query["userId"][0] : req.query["userId"] as string | undefined;
    const result = userId
      ? await pool.query<Pickup>(`SELECT * FROM ltc_pickups WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId])
      : await pool.query<Pickup>(`SELECT * FROM ltc_pickups ORDER BY "createdAt" DESC`);
    return res.json(result.rows);
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.post("/api/pickups", async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const {
      userId,
      userName,
      userPhone,
      location,
      latitude,
      longitude,
      wasteType,
      notes,
      zoneId,
      scheduledDate,
      scheduledTime,
    } = req.body;
   console.log(
  "[PICKUP REQUEST] userId=",
  userId,
  "userPhone=",
  userPhone
);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    await client.query("BEGIN");

    // ------------------------------------------------------------
    // 1. Get the existing LTC customer
    // ------------------------------------------------------------
    const ltcUserResult = await client.query<User>(
      `SELECT * FROM ltc_users WHERE id = $1`,
      [userId]
    );

    if (!ltcUserResult.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "LTC user not found",
      });
    }

    const ltcUser = ltcUserResult.rows[0];

    // ------------------------------------------------------------
    // 2. Find or create the operational users record
    // ------------------------------------------------------------
    const openId = `ltc_${userId}`;

    let operationalUser = await client.query(
      `SELECT id FROM users WHERE "openId" = $1`,
      [openId]
    );

    let operationalUserId: number;

if (operationalUser.rows[0]) {
  operationalUserId = operationalUser.rows[0].id;

  await client.query(
    `
    UPDATE users
    SET
      "ltcUserId" = $1,
      name = COALESCE($2, name),
      phone = COALESCE($3, phone),
      "updatedAt" = NOW(),
      "lastSignedIn" = NOW()
    WHERE id = $4
    `,
    [
      ltcUser.id,
      userName ?? ltcUser.name ?? ltcUser.phoneNumber,
      userPhone ?? ltcUser.phoneNumber,
      operationalUserId,
    ]
  );
} else {
  const newUser = await client.query<{ id: number }>(
    `
    INSERT INTO users
      ("openId", "ltcUserId", name, phone, role)
    VALUES
      ($1, $2, $3, $4, 'user')
    RETURNING id
    `,
    [
      openId,
      ltcUser.id,
      userName ?? ltcUser.name ?? ltcUser.phoneNumber,
      userPhone ?? ltcUser.phoneNumber,
    ]
  );

  operationalUserId = newUser.rows[0].id;
}

    await client.query(
     `
     INSERT INTO customer_wallets (
      "userId",
      "totalBalance",
      "rechargedBalance",
      "referralBalance"
     )
     VALUES ($1, 0, 0, 0)
     ON CONFLICT ("userId") DO NOTHING
     `,
     [operationalUserId]
   );

    // ------------------------------------------------------------
    // 3. Resolve the zone
    // ------------------------------------------------------------
    let operationalZoneId: number | null = null;

    if (zoneId) {
      const zoneResult = await client.query(
        `SELECT id FROM zones WHERE id::text = $1 OR name = $1 LIMIT 1`,
        [String(zoneId)]
      );

      if (zoneResult.rows[0]) {
        operationalZoneId = zoneResult.rows[0].id;
      }
    }

    // If no valid zone was supplied, find the first active zone.
    if (!operationalZoneId) {
      const defaultZone = await client.query(
        `
        SELECT id
        FROM zones
        WHERE status = 'active'
        ORDER BY id
        LIMIT 1
        `
      );

      if (defaultZone.rows[0]) {
        operationalZoneId = defaultZone.rows[0].id;
      }
    }

    if (!operationalZoneId) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "No active zone is available for this pickup",
      });
    }

    // ------------------------------------------------------------
    // 4. Create the existing LTC pickup
    // ------------------------------------------------------------
    const ltcPickupId = `pickup_${uuidv4().replace(/-/g, "").substring(0, 16)}`;
    const n = now();

    await client.query(
      `
      INSERT INTO ltc_pickups
        (
          id,
          "userId",
          "userName",
          "userPhone",
          location,
          latitude,
          longitude,
          "wasteType",
          notes,
          status,
          "zoneId",
          "scheduledDate",
          "scheduledTime",
          "createdAt",
          "updatedAt"
        )
      VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          'pending',$10,$11,$12,$13,$14
        )
      `,
      [
        ltcPickupId,
        userId,
        userName ?? null,
        userPhone ?? null,
        location ?? null,
        latitude ?? null,
        longitude ?? null,
        wasteType ?? "residential",
        notes ?? null,
        String(operationalZoneId),
        scheduledDate ?? null,
        scheduledTime ?? null,
        n,
        n,
      ]
    );

    // ------------------------------------------------------------
    // 5. Create the operational admin pickup
    // ------------------------------------------------------------
    const scheduledTimeValue =
      scheduledDate && scheduledTime
        ? `${scheduledDate} ${scheduledTime}`
        : null;

    const garbagePickup = await client.query(
      `
      INSERT INTO garbage_pickups
        (
          "customerId",
          "zoneId",
          address,
          latitude,
          longitude,
          status,
          notes,
          "scheduledTime"
        )
      VALUES
        (
          $1,$2,$3,$4,$5,'pending',$6,$7
        )
      RETURNING *
      `,
      [
        operationalUserId,
        operationalZoneId,
        location ?? "Location not provided",
        Number(latitude ?? 0),
        Number(longitude ?? 0),
        notes ?? null,
        scheduledTimeValue,
      ]
    );

    await client.query("COMMIT");

  return res.status(201).json({
  success: true,
  data: {
    ltcPickupId,
    garbagePickupId: garbagePickup.rows[0].id,
    operationalUserId,
    zoneId: operationalZoneId,
    status: "pending",
  },
});

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("[PICKUP CREATE ERROR]", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Internal server error",
    });
  } finally {
    client.release();
  }
});

app.get("/api/pickups/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query<Pickup>(`SELECT * FROM ltc_pickups WHERE id = $1`, [req.params["id"]]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: "Pickup not found" });
    return res.json(result.rows[0]);
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.patch("/api/pickups/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"];
    const { status, assignedTo, notes, completedAt } = req.body;
    const existing = await pool.query<Pickup>(`SELECT * FROM ltc_pickups WHERE id = $1`, [id]);
    if (!existing.rows[0]) return res.status(404).json({ success: false, message: "Pickup not found" });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ success: false, message: `Invalid status. Must be: ${VALID_STATUSES.join(", ")}` });
    const updates: string[] = []; const values: unknown[] = []; let i = 1;
    if (status !== undefined) { updates.push(`status = $${i++}`); values.push(status); }
    if (assignedTo !== undefined) { updates.push(`"assignedTo" = $${i++}`); values.push(assignedTo); }
    if (notes !== undefined) { updates.push(`notes = $${i++}`); values.push(notes); }
    if (completedAt !== undefined) { updates.push(`"completedAt" = $${i++}`); values.push(completedAt); }
    if (status === "completed" && !completedAt) { updates.push(`"completedAt" = $${i++}`); values.push(new Date().toISOString()); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: "No valid fields to update" });
    updates.push(`"updatedAt" = $${i++}`); values.push(now()); values.push(id);
    await pool.query(`UPDATE ltc_pickups SET ${updates.join(", ")} WHERE id = $${i}`, values);
    const result = await pool.query<Pickup>(`SELECT * FROM ltc_pickups WHERE id = $1`, [id]);
    return res.json(result.rows[0]);
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => { if (!res.headersSent) res.status(500).json({ success: false, message: err.message }); });

initDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => { log("INFO", "Server started", { port: PORT, env: NODE_ENV, pawapay: PAWAPAY_BASE_URL }); });
}).catch((err) => { console.error("[FATAL] DB init failed:", err); process.exit(1); });

process.on("SIGTERM", async () => { await pool.end(); process.exit(0); });
process.on("SIGINT", async () => { await pool.end(); process.exit(0); });
