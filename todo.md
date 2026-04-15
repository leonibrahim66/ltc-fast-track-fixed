# LTC Fast Track — Project TODO

## Core App Structure
- [x] Initialize Expo + React Native project scaffold
- [x] Configure app.config.ts with LTC Fast Track branding
- [x] Set up Supabase environment variables
- [x] Copy full drizzle schema with all tables (drivers, bookings, wallets, zones, etc.)
- [x] Generate and set app icon (green delivery van with lightning bolt)
- [x] Copy icon to all required asset locations (icon, splash, favicon, android-foreground)

## Source File Integration
- [x] Integrate root _layout.tsx with all context providers
- [x] Integrate home screen index.tsx (news carousel + quick actions)
- [x] Integrate driver-dashboard.tsx
- [x] Integrate driver-register.tsx
- [x] Integrate collector-map.tsx
- [x] Integrate carrier portal.tsx
- [x] Integrate withdraw.tsx
- [x] Integrate finance-dashboard.tsx
- [x] Integrate news-carousel.tsx component
- [x] Integrate news-detail.tsx screen
- [x] Integrate news-context.tsx provider
- [x] Integrate supabase.ts, supabase-auth.ts, supabase-auth-context.tsx, supabase-db.ts
- [x] Integrate financial-service.ts, withdrawal-service.ts
- [x] Integrate google-maps-service.ts
- [x] Integrate trpc.ts, trpc-stub.ts
- [x] Integrate react-native-maps.web.tsx shim

## TypeScript / Build Fixes
- [x] Fix react-native-maps.web.tsx JSX type errors
- [x] Fix portal.tsx missing style properties (earningsCard, progressBarContainer, earningsIcon)
- [x] Fix driver-dashboard.tsx implicit 'any' type errors
- [x] Fix collector-map.tsx implicit 'any' type errors
- [x] Fix tests/auth.logout.test.ts missing phone property
- [x] Verify 0 TypeScript errors

## Assets
- [x] Copy MUZ logo (MUZLOGO.png) to assets/sponsors/
- [x] Copy MUZ flag (MUZFLAG.jpg) to assets/sponsors/
- [x] Copy MUZ for all (MUZFORALL.jpg) to assets/sponsors/
- [x] Copy Garden Court Kitwe hotel images to assets/sponsors/

## Configuration
- [x] Add location permissions (ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION)
- [x] Add camera permissions
- [x] Add expo-camera plugin
- [x] Add expo-location plugin
- [x] Configure Supabase URL and anon key as environment secrets

## SQL Migrations
- [x] 20260222_financial_engine.sql — financial engine tables
- [x] 20260222_create_withdrawal_system.sql — withdrawal system tables
- [x] 20260222_add_withdrawal_config.sql — withdrawal configuration

## Pending / Future
- [ ] Run SQL migrations against Supabase database
- [ ] Configure Google Maps API key (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)
- [ ] Test driver registration flow end-to-end
- [ ] Test withdrawal flow with mobile money providers
- [ ] Configure push notifications for booking alerts

## Logo Update
- [x] Replace generated app icon with user-provided LTC Fast Track logo (ltc-fasttracklogo.png)
- [x] Resize and copy to all required asset locations (icon, splash, favicon, android-foreground)
- [x] Update app.config.ts logoUrl with new S3 URL

## Logo Update 2
- [x] Replace app icon with new applogo.png (green background, rounded rectangle, LTC Fast Track text)
- [x] Resize and deploy to all asset locations (icon, splash, favicon, android-foreground)
- [x] Upload to CDN and update app.config.ts logoUrl

## Google Maps Integration
- [x] Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY environment secret
- [x] Add Google Maps API key to app.config.ts android and ios config
- [x] Verify collector map and zone features work with the API key

## SQL Migrations
- [x] Execute 20260222_financial_engine.sql
- [x] Execute 20260222_create_withdrawal_system.sql
- [x] Execute 20260222_add_withdrawal_config.sql
- [x] Verify all tables created successfully (7 tables confirmed)

## Photo/Document Upload Fix
- [x] Audit all screens using ImagePicker (driver-register, collector-register, profile-edit, payment, dispute, admin-news)
- [x] Add expo-image-picker plugin to app.config.ts with iOS photosPermission + cameraPermission
- [x] Fix deprecated MediaTypeOptions.Images → ["images"] in (auth)/driver-register.tsx
- [x] Fix deprecated MediaTypeOptions.Images → ["images"] in payment-confirmation.tsx
- [x] Fix deprecated MediaTypeOptions.Images → ["images"] in report-dispute.tsx
- [x] Add missing requestMediaLibraryPermissionsAsync in collector-profile-edit.tsx
- [x] Add missing requestMediaLibraryPermissionsAsync in admin-news-management.tsx
- [x] Add missing requestMediaLibraryPermissionsAsync in report-dispute.tsx gallery picker
- [x] Verify 0 TypeScript errors after all fixes

## Customer Registration - Property Type Selection
- [x] Add select-property mode to AuthMode type in role-auth.tsx
- [x] Add PropertyType type (residential | commercial | industrial)
- [x] Create inline property type selection step with emoji cards (🏚️ Residential, 🏙️ Commercial, 🏗️ Industrial)
- [x] Wire Register button to show property selection screen first
- [x] Back button navigates: select-property → login, register → select-property
- [x] Pass selectedPropertyType into register() call so correct role is stored
- [x] Add INDUSTRIAL to USER_ROLES constant in constants/app.ts
- [x] Add industrial to getRoleDashboard and getExpectedRoles
- [x] Show selected property type badge on create account form with Change button
- [x] 0 TypeScript errors confirmed

## Zone Manager Dashboard Upgrade
- [x] Audit current collector screens and schema
- [x] Build Section 1: Dashboard Overview (zone info + commission split cards)
- [x] Build Section 2: Household Management (filtered by zone_id, with status filters)
- [x] Build Section 3: Driver Management (active drivers, pending applications, invite code)
- [x] Build Section 4: Zone Pickups (tabs: Pending/Assigned/In Transit/Completed)
- [x] Build Section 5: Earnings & Withdrawals (gross/commission/net/withdrawal history)
- [x] Build Section 6: Settings (profile, payment details, assigned zone - read-only)
- [x] Wire all 6 sections into collector tab navigation
- [x] Verify 0 TypeScript errors

## Zone Manager Auth Flow Upgrade
- [x] Rename "Garbage Collector" → "Zone Manager" in all UI labels
- [x] Update role constant: add ZONE_MANAGER, keep COLLECTOR for backward compatibility
- [x] Migrate existing collector role references throughout codebase
- [x] Restructure registration Step 1: First Name, Last Name, Phone, Password, Confirm Password
- [x] Restructure registration Step 2: Province dropdown (10 Zambian provinces), Town/City dropdown (filtered), Zone dropdown (filtered), proposed zone name text field
- [x] Save province_id, town_id, selected_zone_id, proposed_zone_name, kyc_status="pending"
- [x] Add dev-mode bypass: allow pending_review status to access dashboard
- [x] Add dashboard banner: "Development Mode: Zone Manager approval pending."
- [x] Verify 0 TypeScript errors

## Zone Management System Alignment
- [x] Audit existing zone management files in admin and super admin panels
- [x] Replace all "Collector" labels with "Zone Manager" in zone management screens
- [x] Update zone dashboard: one-manager-per-zone logic, status display (Active/Unassigned)
- [x] Add zone info: Assigned Zone Manager, Province, Town, Households, Drivers, Monthly Revenue
- [x] Show "Unassigned – Pending Applications Available" when no manager assigned
- [x] Add "Assign from Pending Applications" button linking pending_review zone_managers
- [x] Implement Approve & Assign: set status=active, assign zone_id, set kyc_status=verified
- [x] Super Admin: reassign zone manager, deactivate manager, transfer households, override warning
- [x] Enforce unique active zone_manager per zone_id (app-level constraint)
- [x] Verify 0 TypeScript errors

## Garbage Collection Driver System
- [x] Add garbage_driver role to constants and auth context
- [x] Add "Login / Register as Garbage Collection Driver" button on welcome screen
- [x] Update routing: garbage_driver → /(garbage-driver) dashboard
- [x] Build 2-step registration: Step 1 (name/phone/password/NRC/license/plate), Step 2 (invite code)
- [x] Link driver to zone_manager_id via invite code on registration
- [x] Set status=pending_manager_approval on registration
- [x] Build Garbage Driver Dashboard with zone-scoped pickup tabs (Pending/Assigned/In Transit/Completed)
- [x] Zone enforcement: drivers only see pickups in their zone
- [x] Update Zone Manager Drivers tab: Pending/Active/Suspended with Approve action
- [x] On Approve: set status=active, assign zone_id from zone manager
- [x] Build activity logging: registered, approved, pickup assigned/started/completed
- [x] Surface activity logs in Admin Zone Panel
- [x] Surface activity logs in Super Admin Panel
- [x] Verify 0 TypeScript errors

## Garbage Driver System Upgrade (Live Map, Pickups, Chat)

- [x] Add APP_CONFIG.devMode flag to constants/app.ts
- [x] Dev mode bypass: allow garbage_driver login when status=pending_manager_approval
- [x] Show "Development Mode: Approval pending." banner on driver dashboard
- [x] Build My Pickups screen: Assigned/In Progress/Completed tabs, zone-scoped
- [x] Show household, address, subscription status, notes, lat/lng per pickup
- [x] Generate mock pickup data in devMode when no real pickups exist
- [x] Build Live Map screen: driver current location + pickup pin + route + ETA
- [x] Update driver location every 20s (configurable)
- [x] Store location in @ltc_driver_status (driver_id, zone_id, lat, lng, is_online, last_updated)
- [x] Implement full status flow: pending→assigned→accepted→in_progress→completed→confirmed
- [x] Accept / Start / Complete action buttons on pickup detail
- [x] Log all status changes to activity_logs
- [x] Status changes visible to Zone Manager and Admin in real-time (10s polling)
- [x] Build in-app pickup chat: pickup_messages(id, pickup_id, sender_id, sender_role, message, created_at)
- [x] Real-time chat sync (5s polling)
- [x] Add Call button (tel: link) on pickup detail and chat header
- [x] Update Zone Manager pickup screen with live event feed
- [x] Update Admin Zone Panel with live feed of pickup events (10s auto-refresh)
- [x] Security: no cross-zone, no logistics, no financial access (enforced in devMode too)
- [x] TypeScript: 0 errors

## Driver Invite Code System Upgrade

- [x] Create driver_invite_codes data model (id, code, zone_manager_id, zone_id, usage_limit, used_count, expires_at, created_at, is_active)
- [x] Create invite-codes-context.tsx with AsyncStorage persistence
- [x] Rebuild Zone Manager Drivers tab: Invite Codes list (code, usage, expiry, status)
- [x] Add Generate Invite Code button with options (usage limit, expiry date)
- [x] Add Disable Code and Delete Code actions
- [x] Update driver registration: validate invite code (exists, not expired, under limit)
- [x] Auto-assign zone_manager_id and zone_id from validated invite code
- [x] Increment used_count on successful registration
- [x] Show error message for invalid/expired/exhausted codes
- [x] Add invite codes visibility to Admin Zone Panel (per zone)
- [x] Zone scoping enforced: managers only see their own codes
- [x] TypeScript: 0 errors

## Customer Registration Upgrade (Province + Zone Matching)
- [x] Audit current customer registration and admin customer management files
- [x] Add province, city, area_type, area_name, full_address, zone_id to User type in auth-context
- [x] Rebuild registration Step 1: Phone, Password, Confirm Password
- [x] Rebuild registration Step 2: Province (10 Zambian provinces), City/Town (filtered), Area Type (Residential/Commercial/Industrial), Area Name, Full Address
- [x] Implement automatic zone matching: search zones by province+city+area_name, assign zone_id or NULL
- [x] Mark unassigned customers (zone_id = NULL) for admin manual allocation
- [x] Update admin customer management: Province/City/Area Type/Zone filters
- [x] Admin display structure: Province → City → Zone → Customers
- [x] Show unassigned customers section in admin panel
- [x] TypeScript: 0 errors

## Customer Registration - Name Fields
- [x] Add firstName and lastName to User type in auth-context.tsx
- [x] Add firstName and lastName to register function persistence
- [x] Add Name (left) and Surname (right) side-by-side fields above Phone in Step 1
- [x] TypeScript: 0 errors

## Hidden Admin Portal Gesture
- [x] Remove admin portal button from visible welcome screen UI
- [x] Add 4-upward-swipe gesture detector to reveal admin portal button
- [x] Show subtle haptic feedback on each swipe (Light impact)
- [x] Auto-hide admin button after 10 seconds of inactivity
- [x] TypeScript: 0 errors

## Subscription Bypass (Dev Mode)
- [x] Audit customer dashboard, pickup request, and bin location screens for subscription gates
- [x] Add devMode bypass: allow pickup request and bin pin without active subscription
- [x] Show dev banner: "Development Mode: Subscription pending approval."
- [x] Preserve subscription logic for production re-enable
- [x] TypeScript: 0 errors

## Council Admin Panel
- [x] Add council_admin role to AdminRole enum in admin-context.tsx
- [x] Add council_admin fields (province, city) to AdminUser type in admin-context.tsx
- [x] Add hardcoded council admin accounts (council_lusaka, council_copperbelt)
- [x] Build Council Admin login screen (council-admin-login.tsx)
- [x] Build Council Admin Dashboard with province/city-scoped overview cards (council-admin-dashboard.tsx)
- [x] Build Zones screen filtered by province/city (council-zones.tsx)
- [x] Build Zone Managers screen filtered by province/city (council-managers.tsx)
- [x] Build Drivers screen filtered by province/city (council-drivers.tsx)
- [x] Build Customers screen filtered by province/city (council-customers.tsx)
- [x] Build Pickups screen with live auto-refresh (council-pickups.tsx)
- [x] Build Activity Logs screen filtered by province/city (council-activity.tsx)
- [x] Build Sanitation Reports screen with zone performance metrics (council-sanitation.tsx)
- [x] Build GPS Tracking screen with live driver locations (council-gps.tsx)
- [x] Build Tonnage Records screen with zone-by-zone data (council-tonnage.tsx)
- [x] Wire Council Admin into IT Management Portal (Council Admin Portal button in admin-login.tsx)
- [x] Route council_admin login → council-admin-dashboard (admin-login.tsx + admin-panel.tsx)
- [x] Enforce province/city security: all queries filtered by adminUser.province/city
- [x] Block financial access: no commission, no wallet, no payment config in any council screen
- [x] TypeScript: 0 errors

## Council Admin Panel — Extension (Live Map, Tonnage, Export)

- [x] Build Live City Map screen (council-live-map.tsx) with zone filter, driver GPS, online/offline, active routes
- [x] Add Live City Map entry to council dashboard menu
- [x] Build waste_tonnage_records data model and context (lib/tonnage-context.tsx)
- [x] Rebuild council-tonnage.tsx with full waste_tonnage_records model (zone/area/monthly views)
- [x] Add TonnageProvider to app _layout.tsx
- [x] Build Data Export Center screen (council-export.tsx) — CSV export for 7 data types
- [x] Add council-specific export columns to export-utils.ts
- [x] Add Export Center entry to council dashboard menu
- [x] Align data storage keys across Zone, Admin, and Council panels
- [x] Add unique council admin credentials for all 10 Zambian provinces
- [x] TypeScript: 0 errors

## UI Improvements

- [x] Make welcome screen fully scrollable (vertical) for all device sizes
- [x] Reverted welcome screen to original pre-scrollable state (user request)
- [x] Enable vertical scroll on welcome screen (layout only, no UI/logic changes)
- [x] Add animated scroll hint arrow on welcome screen (first launch, fades after first scroll)
- [x] Add sticky header (logo + app name) for tablet/landscape on welcome screen

## Backend Payment Layer

- [ ] Read server README and existing DB schema patterns
- [ ] Create payment_transactions table (Drizzle schema)
- [ ] Run DB migration for payment_transactions
- [ ] Build PaymentService with 10% commission calculation
- [ ] Build POST /api/request-payment endpoint
- [ ] Build POST /api/release-payment endpoint
- [ ] Build POST /api/withdraw endpoint
- [ ] Build POST /api/payment-callback endpoint
- [ ] Register payment routes in server index
- [ ] Prepare MTN environment variable stubs (no integration yet)
- [ ] TypeScript: 0 errors

## Backend Payment Layer (MTN-Ready)

- [x] Add payment_transactions table to Drizzle schema (drizzle/schema.ts)
- [x] Add platform_wallet table to Drizzle schema
- [x] Add provider_wallets table to Drizzle schema
- [x] Run database migration — all 3 tables confirmed in DB
- [x] Build PaymentService with calculateCommission (10% rule, server-side only) (server/payment-service.ts)
- [x] Implement requestPayment — creates pending transaction, logs before payout
- [x] Implement releasePayment — credits provider 90%, platform 10%
- [x] Implement requestWithdrawal — validates balance, deducts, logs withdrawal reference
- [x] Implement handlePaymentCallback — webhook handler, auto-triggers releasePayment on success
- [x] Build paymentRouter with 4 endpoints + 4 query helpers (server/routers-payment.ts)
- [x] Register paymentRouter as paymentService in appRouter (server/routers.ts)
- [x] Prepare MTN env var stubs: MTN_BASE_URL, MTN_COLLECTION_KEY, MTN_DISBURSEMENT_KEY, MTN_API_USER, MTN_API_KEY
- [x] Write vitest tests for commission logic — 7/7 passing
- [x] TypeScript: 0 errors
- [x] No UI changes made
- [x] No existing commission/payment/carrier logic modified

## MTN MoMo RequestToPay Integration

- [x] Build MTN MoMo client (server/mtn-momo.ts): token provisioning, RequestToPay, status polling
- [x] Wire MTN client into PaymentService.requestPayment (replace stub)
- [x] Wire MTN client into PaymentService.handlePaymentCallback (replace stub) with cross-verification
- [x] Add MTN_COLLECTION_SUBSCRIPTION_KEY env var stub
- [x] Support sandbox test MSISDN numbers (46733123450=SUCCESS, 56733123450=FAILED, 36733123450=PENDING)
- [x] Write vitest tests for MTN client (mocked axios) — 15/15 passing
- [x] All 858 tests passing (37 test files)
- [x] TypeScript: 0 errors
- [x] No UI changes
- [x] Commission logic untouched

## MTN MoMo Disbursement Integration

- [x] Add Disbursement token provisioning to mtn-momo.ts (separate token cache from Collection)
- [x] Add disbursementTransfer() to mtn-momo.ts: POST /disbursement/v1_0/transfer
- [x] Add getDisbursementStatus() to mtn-momo.ts: GET /disbursement/v1_0/transfer/{referenceId}
- [x] Add pollDisbursementUntilFinal() helper to mtn-momo.ts
- [x] Wire Disbursement into PaymentService.requestWithdrawal (replace stub)
- [x] Extend requestWithdrawal return type with mtnDisbursementAccepted, mtnDisbursementError, manualMode
- [x] Add MTN_DISBURSEMENT_SUBSCRIPTION_KEY env var stub
- [x] Write vitest tests for Disbursement client (mocked axios) — 21/21 passing
- [x] All 878 tests passing (38 test files)
- [x] TypeScript: 0 errors
- [x] No UI changes
- [x] Commission logic untouched

## Payment Monitoring System

- [ ] Enable APP_ENV=sandbox mode with sandbox logging in mtn-momo.ts
- [ ] Verify MTN_BASE_URL routes to sandbox.momodeveloper.mtn.com in sandbox mode
- [ ] Build secure MTN webhook endpoint POST /api/mtn/webhook with signature validation
- [ ] Cross-verify MTN callback with status API before updating payment_transactions
- [ ] Build Provider Earnings screen (My Earnings) — total earnings, balance, withdrawals, history
- [ ] Build Admin Withdrawal Management panel — view/approve/reject requests, log admin actions
- [ ] Build transaction monitoring service — status tracking, failed/pending detection, auto-retry
- [ ] Add withdrawal_requests table to schema for admin approval workflow
- [ ] Write vitest tests for webhook and monitoring service
- [ ] TypeScript: 0 errors

## Payment Monitoring System (MTN Sandbox + Webhook + Earnings + Monitor)

- [x] Enable sandbox mode: APP_ENV env var, isSandbox() helper in mtn-momo.ts
- [x] Add sandbox logging: sandboxLog() called in requestToPay and disbursementTransfer
- [x] MTN base URL auto-routes to sandbox.momodeveloper.mtn.com when APP_ENV=sandbox
- [x] Build secure MTN webhook: POST /api/mtn/webhook with raw body capture + HMAC-SHA256 signature validation
- [x] Webhook cross-verifies payment status with MTN API before updating DB (prevents spoofed callbacks)
- [x] Webhook updates payment_transactions status automatically (completed/failed)
- [x] Build Provider Earnings screen (app/provider-earnings.tsx): total earnings, available balance, withdrawals, transaction history, withdrawal request form
- [x] Add withdrawal_requests table to Drizzle schema and create in DB
- [x] Build Admin Withdrawal Management screen (app/admin-withdrawals.tsx): view all requests, approve/reject with notes, status filter tabs, admin action logging
- [x] Access control: withdrawal management restricted to superadmin and finance roles
- [x] Build transaction monitoring service (server/transaction-monitor.ts): polls every 60s, cross-verifies with MTN API, auto-retries failed collections (max 3), marks timed-out transactions as failed
- [x] Register transaction monitor in server index.ts: starts on server boot, stops on graceful shutdown
- [x] Write vitest tests for transaction monitor (11 tests passing)
- [x] All 889 tests passing (40 test files)
- [x] TypeScript: 0 errors
- [x] No UI changes to existing screens
- [x] Commission logic untouched

## Commission Configuration System

- [ ] Build CommissionService (server/commission-service.ts): per-service rates, platform MSISDN, server-side calculation
- [ ] Create commission_rules table in schema (id, service_type, rate, is_active, created_by, updated_at)
- [ ] Create commission_audit_log table in schema (id, changed_by, old_rate, new_rate, service_type, reason, created_at)
- [ ] Add commission tracking fields to payment_transactions (commission_amount, provider_amount, platform_amount, transaction_source)
- [ ] Update PaymentService to use CommissionService for all commission calculations
- [ ] Build Finance Commission Overview screen (app/finance-commission.tsx): total/daily/monthly/zone/city/province breakdowns
- [ ] Add CSV, Excel, and PDF export to Finance Commission Overview
- [ ] Build Super Admin Commission Settings screen (app/admin-commission-settings.tsx): adjust per-service rates, view audit log
- [ ] Enforce role security: only superadmin can modify rates, finance can view only
- [ ] Record all commission rate changes in commission_audit_log
- [ ] Wire platform MSISDN (0960819993) into commission payout config
- [ ] Write vitest tests for CommissionService
- [ ] TypeScript: 0 errors
- [ ] No changes to existing payment flows

## Commission Configuration System (COMPLETED)

- [x] Build CommissionService (server/commission-service.ts) with per-service configurable rates
- [x] Add PLATFORM_CONFIG with MSISDN 0960819993 and ZMW currency
- [x] Create commission_rules table in DB with default 10% rates for garbage/carrier/subscription
- [x] Create commission_audit_log table in DB for change tracking
- [x] Add commission tracking fields to payment_transactions (commissionAmount, platformAmount, transactionSource, appliedCommissionRate)
- [x] Update PaymentService to use CommissionService for all commission calculations
- [x] Build Finance Commission Overview screen (finance-commission.tsx) with daily/monthly/zone/city/province breakdowns
- [x] Add CSV, Excel, PDF export to Finance Commission Overview
- [x] Build Super Admin Commission Settings screen (admin-commission-settings.tsx) with per-service rate adjustment
- [x] Add audit log tab to Commission Settings showing all rate changes
- [x] Superadmin-only access control on Commission Settings (finance redirected to read-only view)
- [x] Write vitest tests for CommissionService (13/13 passing)
- [x] All 902 tests passing (40 test files)
- [x] TypeScript: 0 errors
- [x] No changes to existing payment flows
- [x] Commission logic remains server-side only

## Firebase Integration

- [ ] Install Firebase SDK packages (firebase, @react-native-firebase/app, messaging, analytics, crashlytics, in-app-messaging)
- [ ] Add 6 Firebase env var stubs via webdev_request_secrets
- [ ] Create lib/firebase.ts with initialization and exports (messaging, analytics, crashlytics, inAppMessaging)
- [ ] Build lib/firebase-notifications.ts with FCM token registration and 6 push event types
- [ ] Build lib/firebase-analytics.ts with 6 analytics event trackers
- [ ] Wire analytics into app _layout.tsx (login, registration events)
- [ ] Wire crashlytics error boundary into app _layout.tsx
- [ ] Build lib/firebase-in-app-messaging.ts with 4 contextual message triggers
- [ ] Wire in-app messaging triggers into relevant screens
- [ ] Write vitest tests for Firebase service modules
- [ ] TypeScript: 0 errors

## Firebase Integration (COMPLETED)

- [x] Install Firebase JS SDK (firebase@11.x)
- [x] Add all 6 Firebase env var stubs (EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, EXPO_PUBLIC_FIREBASE_APP_ID)
- [x] Create lib/firebase.ts with app init, messaging, analytics, crashlytics, in-app messaging exports
- [x] Build lib/firebase-notifications.ts with FCM token registration and 6 push notification event types (payment confirmation, new pickup request, pickup scheduled, pickup completed, driver arriving, withdrawal status)
- [x] Build lib/firebase-analytics.ts with 6 analytics event trackers (user registration, login, subscription activation, payment completion, pickup request created, withdrawal request)
- [x] Build lib/firebase-crashlytics.ts with error boundary and crash reporting helpers
- [x] Build lib/firebase-in-app-messaging.ts with 4 contextual message triggers (welcome, pickup reminder, inactive user, new services announcement)
- [x] Wire Firebase init (Crashlytics + FCM listeners) into app _layout.tsx
- [x] Write vitest tests for Firebase services (self-contained, 935/936 total tests passing)
- [x] TypeScript: 0 errors
- [x] No UI changes to existing screens

## Customer Home Screen — News & Sponsor Carousel Enhancement
- [x] Audit NewsCarousel, news-context, types/news.ts and sponsor assets
- [x] Upgrade NewsCarousel to render sponsor slides with distinct "SPONSORED" badge, amber type pill, sponsor name, and "Tap to learn more" CTA
- [x] Sponsor dot indicators use amber colour to distinguish from news slides
- [x] Add 2 sponsor slides to SAMPLE_HOME_NEWS: Mine Workers Union of Zambia (MUZ) and Garden Court Kitwe
- [x] Wire all 7 sponsor images from assets/sponsors/ into SponsorDetails.images arrays
- [x] Update SponsorDetails.images type to accept local require() assets (string | number | object)[]
- [x] Create sponsor-detail.tsx: image gallery with swipe + dot indicators + thumbnail strip, sponsor type pill, full description, Visit Website and Call buttons, paid sponsorship disclaimer
- [x] Route sponsor carousel taps → sponsor-detail.tsx (news taps still go to news-detail.tsx)
- [x] TypeScript: 0 errors

## Smart Driver Operations Upgrade
- [x] driver_status table added to Drizzle schema (driver_id, zone_id, latitude, longitude, is_online, last_updated)
- [x] driver_status table created in PostgreSQL database
- [x] lib/driver-tracking-service.ts — GPS updates every 20s, persists to AsyncStorage + DB driver_status, distanceMetres + etaMinutesFromMetres helpers
- [x] lib/route-optimization-service.ts — Google Maps Directions API with nearest-neighbour greedy fallback, decodePolyline, formatRouteDistance, formatRouteDuration
- [x] lib/driver-arrival-alerts.ts — 5 lifecycle alert events (accepted, started, near, reached, completed), AsyncStorage persistence, pickupStatusToAlertEvent mapper
- [x] Driver pickups screen — Route button opens optimised pickup sequence modal with distance/ETA per stop and nav links
- [x] Driver pickups screen — Arrival alert fired on Accept / Start / Complete status transitions
- [x] Driver map screen — Start Route / Re-optimise floating button
- [x] Driver map screen — Route polyline overlay (dashed orange line connecting all stops in optimised order)
- [x] Driver map screen — Pickup markers numbered by optimised sequence (green = sequenced, orange = in_progress)
- [x] Driver map screen — Route info badge (total distance + duration + source)
- [x] Driver map screen — Proximity alerts: "near" at 500 m, "reached" at 100 m (fired once per pickup per session)
- [x] 21 unit tests passing for all new services
- [x] TypeScript: 0 errors

## APK Build Fixes
- [x] Register @react-native-firebase/app plugin in app.config.ts plugins array
- [x] Create google-services.json stub (placeholder for EAS build)
- [x] Update 19 outdated Expo SDK packages to SDK 54 expected versions
- [x] Add expo-clipboard to package.json dependencies
- [x] Verify 0 TypeScript errors after fixes
- [x] Verify clean expo prebuild passes

## Firebase & API Key Validation
- [x] Restart dev services with all Firebase keys applied
- [x] Validate all 9 API keys (Firebase x6, Google Maps, Supabase x2) - all PASS
- [x] Update google-services.json with real Firebase project values (project: ltc-firebase-key)
- [x] Add firebase-keys.test.ts - 10 tests all passing
- [x] Add runtime crash check script (scripts/check-runtime.mjs) - all PASS
- [x] TypeScript: 0 errors, 966 tests pass

## Auth Redirect Fixes
- [x] App always starts at welcome screen (never skips to dashboard)
- [x] Customer login redirects to customer home (tabs)
- [x] Garbage driver login redirects to garbage-driver dashboard
- [x] Collector login redirects to collector dashboard
- [x] Admin login redirects to admin panel
- [x] Zone manager login redirects to zone admin dashboard
- [x] Carrier driver login redirects to carrier dashboard
- [x] Logout clears session and redirects to welcome screen for all roles
- [x] No stale route persisted across sessions

## MTN Sandbox Payment Testing UI
- [x] Remove hardcoded payment receiver numbers from payment screen UI
- [x] Add "Enter Payment Number / Merchant Code" manual input field
- [x] Add Sandbox Test / Live Production toggle switch
- [x] Sandbox mode: show manual input + amber sandbox notice, skip production number
- [x] Live Production mode: restore +260960819993, hide manual input
- [x] Pass sandboxMode and overrideReceiverNumber params to payment-confirmation screen
- [x] payment-confirmation shows "Sandbox Number" label in amber when in sandbox mode
- [x] 17 unit tests written and passing for sandbox toggle logic
- [x] TypeScript 0 errors confirmed

## Font Loading Timeout Fix
- [ ] Wrap useFonts / Font.loadAsync in try/catch so app renders on timeout
- [ ] Add system font fallback when custom fonts fail to load
- [ ] Ensure SplashScreen.hideAsync is always called even on font failure
- [x] Verify TypeScript 0 errors

## Subscription Payment Workflow Fix
- [x] Add AsyncStorage persistence to SubscriptionApprovalContext (requests survive app restart)
- [x] Add transactionReference and paymentId fields to SubscriptionRequest interface
- [x] Auto-create subscription approval request in payment-confirmation.tsx after createPayment succeeds
- [x] Link approval request to payment reference, transaction ID, user ID, plan name, and amount
- [x] Set approval request status = pending on creation
- [x] Ensure admin Subscription Approvals screen shows all real pending requests (not just seed data)
- [x] Verify TypeScript 0 errors
- [x] Write unit tests for the new auto-approval-request creation logic

## Subscription Approval Notifications + Status Banner + Auto-Activate
- [x] Create lib/subscription-notification-service.ts with sendLocalNotification helper (expo-notifications immediate trigger)
- [x] Wire approveRequest in subscription-approval-context to fire approval notification + add to NotificationsContext
- [x] Wire rejectRequest in subscription-approval-context to fire rejection notification + add to NotificationsContext
- [x] Add "Pending Approval" status variant to subscription card on customer home screen
- [x] Show pending approval banner when user has a pending subscription request (no active subscription)
- [x] Auto-activate subscription in auth-context (updateUser) when admin calls activateAccount
- [x] Wire activateAccount in subscription-approval-context to call updateUser with subscription data
- [x] Verify TypeScript 0 errors
- [x] Write unit tests for notification + auto-activation logic

## Production Readiness Audit

- [ ] Add server tRPC endpoints: commission audit log, driver activity log, platform wallet summary, all transactions
- [ ] Add server tRPC endpoints: admin get all users from DB, admin get all bookings from DB
- [x] Build Commission Dashboard screen reading from commission_audit_log + payment_transactions (total, daily, monthly, per-transaction)
- [ ] Wire admin-commission screen to use DB data (trpc.paymentService.platformSummary + commission audit log)
- [ ] Wire admin-transactions screen to also show DB payment_transactions alongside AsyncStorage payments
- [ ] Wire admin-users screen to also show DB users alongside AsyncStorage users
- [ ] Wire admin-pickups screen to also show DB bookings alongside AsyncStorage pickups
- [ ] Add Commission Dashboard link to admin-panel and admin-dashboard
- [ ] Validate all data linking: user_id, transaction_id, booking_id, driver_id
- [ ] Run TypeScript check and full test suite
- [ ] Write production readiness audit tests

## System-Wide Data Flow Repair (Full Audit)

- [ ] Fix 1: Wire auth-context register() to emit addRegistration() to ITRealtime
- [ ] Fix 2: Wire pickups-context createPickup() to emit addLivePickup() + addEvent() to ITRealtime
- [ ] Fix 3: Wire pickups-context updatePickup/updatePickupStatus to emit updateLivePickup() to ITRealtime
- [ ] Fix 4: Wire payment-confirmation.tsx to emit addEvent(payment_received) to ITRealtime
- [ ] Fix 5: Replace admin-withdrawals.tsx MOCK_REQUESTS with useWithdrawals() context
- [ ] Fix 6: Wire admin-withdrawals approve/reject to update withdrawals-context
- [ ] Fix 7: Wire admin-carrier-drivers approve to add driver to carrier_driver_accounts
- [ ] Fix 8: Fix admin-context refreshStats usersByRole to use real role counts
- [ ] Fix 9: Add pending subscription approval requests to admin-subscriptions.tsx
- [ ] Fix 10: Upgrade admin-dashboard.tsx recent activity to unified multi-source feed
- [ ] Fix 11: Add commission summary widget to admin-dashboard.tsx
- [ ] Fix 12: Wire payment approve/reject in admin-payments to send user notification

## System-Wide Data Flow Repairs (Comprehensive Audit)
- [ ] Fix 1: Registration → emit addRegistration to ITRealtime (admin-live-registrations)
- [ ] Fix 2: Pickup creation → emit addLivePickup to ITRealtime (admin-live-pickups)
- [ ] Fix 3: Pickup status changes → emit updateLivePickup to ITRealtime
- [ ] Fix 4: Payment submission → emit addEvent + admin notification
- [ ] Fix 5: Dispute creation → emit addEvent + admin notification
- [ ] Fix 6: Admin Withdrawals → replace MOCK_REQUESTS with WithdrawalsContext real data
- [ ] Fix 7: Admin Dashboard commercial users → read real role breakdown from AsyncStorage
- [ ] Fix 8: Admin Dashboard Recent Activity → include payments, registrations, disputes
- [ ] Fix 9: Admin Dashboard Commission widget → add today's commission card
- [ ] Fix 10: Driver approval → emit admin notification + update driver account status
- [ ] Fix 11: Carrier driver registration → set status to pending_approval (not auto-approved)
- [ ] Fix 12: AdminStats type → add totalResidential + totalCommercial fields

## Welcome Screen Scroll Fix
- [x] Wrap Welcome Screen content in ScrollView so all login/register options are visible on small Android screens

## Android Build Fix
- [x] Set minSdkVersion=24, compileSdkVersion=34, targetSdkVersion=34 in expo-build-properties

## Android Build Fix — SDK 35
- [x] Update compileSdkVersion and targetSdkVersion to 35 for androidx.core:core-ktx:1.16.0 compatibility

## Android Build — Kotlin & JVM Config
- [x] Add kotlinVersion: "1.9.24" to expo-build-properties android block
- [x] Add jvmTarget: "17" to expo-build-properties kotlin block

## Android Build — Kotlin/KSP Fix
- [x] Update kotlinVersion from 1.9.24 to 2.1.21 to resolve KSP version mismatch

## Global Responsive Layout
- [x] Create useResponsive hook with scale helpers (s, fs, sp, iconSize, hp, wp, pick)
- [x] Apply responsive layout to Welcome screen
- [x] Apply responsive layout to role-auth, login, register screens
- [x] Batch-apply responsive scaling to all 86 screens with StyleSheet.create
- [x] Apply responsive spacing to customer home screen
- [x] Apply responsive scaling to collector dashboard
- [x] Apply responsive scaling to tab layout
- [x] Verify TypeScript: 0 errors after all changes

## Welcome Flow Redesign
- [x] Rewrite welcome screen with single Get Started button
- [x] Preserve 4-upswipe hidden IT Management Portal on welcome screen only
- [x] Create new role selection screen (/(auth)/role-select.tsx)
- [x] Register role-select in (auth)/_layout.tsx
- [x] Wire Get Started -> role-select navigation
- [x] Wire role cards -> role-auth?role=X navigation
- [x] Confirm no admin gesture on role-select screen

## Subscription Status Sync Fix
- [x] Identified root cause: updateUser() was patching the admin session, not the customer record
- [x] Fixed SubscriptionApprovalBridge in _layout.tsx to write subscription directly to customer userId in @ltc_users_db
- [x] Fixed SubscriptionApprovalBridge to also update @ltc_user session if the customer is currently logged in
- [x] Fixed SubscriptionApprovalBridge to emit StorageEventBus on both keys after activation
- [x] Added useFocusEffect on Home screen to emit @ltc_user bus key on every focus (triggers AuthProvider reload)
- [x] Added AppState listener on Home screen to reload on foreground return
- [x] Added StorageEventBus subscription on Home screen for @ltc_user key

## Role Card Visibility Improvement
- [x] Changed card background from white (#fff) to soft mint (#E0F2F1)
- [x] Updated card border from #E5E7EB to #B2DFDB for better definition
- [x] Changed role title color to near-black dark green (#1A2E1A) with fontWeight 700
- [x] Changed description text color to dark grey (#37474F) with fontWeight 500 and 100% opacity
- [x] Updated each role icon badge bgColor to a richer tinted shade per role
- [x] Updated each role icon color to a deeper, more saturated shade per role

## Zone Relationship Logic Fix
- [x] Fix driver approval to write zoneId (camelCase) so garbage driver dashboard filters work
- [x] Add zoneId and zoneName fields to PickupRequest type
- [x] Attach customer assignedZoneId to pickup request at creation time
- [x] Add assignedZoneName field to User type in auth-context
- [x] Add inline zone assignment modal to admin-users screen (customers and drivers)
- [x] Add StorageEventBus emit after zone assignment writes
- [x] Fix confirmZoneAssignment and handleRemoveZone to use object format matching auth-context
- [x] Show unassigned zone warning banner in admin-users screen
- [x] Show per-card zone badge and Assign Zone / Reassign button for customers and drivers

- [x] Add zone selection step to customer registration flow (step 5 of 5)

## Address-Based Zone Filtering & Live Map Card

- [x] Add filteredZones computed value to customer registration Step 5 (filters by keywords from entered address)
- [x] Add isFiltered banner in zone selection step when address narrows the list
- [x] Add zone chip to customer Home screen header (shows assignedZoneName below greeting)
- [x] Add zone chip to "Your Location" section header in Home screen
- [x] Add live Google Maps card to customer Home screen (replaces Request Pickup button card)
- [x] Request foreground location permission using expo-location on Home screen mount
- [x] Show green pin marker at user's current location on MapView
- [x] Show Request Pickup button in map overlay bar (bottom of map card)
- [x] Show loading/error placeholder states when location is unavailable
- [x] Keep My Pickups and Report Issue as secondary action buttons below map card
- [x] Add 15 unit tests for zone filtering and zone chip display logic (all passing)

## Real-Time Driver Tracking on Customer Home Map

- [x] Restyle map overlay container to dark green (#1B4332) with white text
- [x] Keep Request Pickup button visible and responsive in dark green overlay
- [x] Driver tracking: existing DriverTrackingService writes real GPS to @ltc_driver_status every 20s (no changes needed)
- [x] Customer Home map: detect active (assigned/accepted/in_progress) pickup for current user
- [x] Customer Home map: poll @ltc_driver_status every 5s for the assigned driver's coordinates
- [x] Customer Home map: show green pin for customer pickup location
- [x] Customer Home map: show red pin marker for driver's live GPS position
- [x] Customer Home map: draw dashed red Polyline from driver location to pickup location
- [x] Customer Home map: auto-fit map bounds to show both pins via fitToCoordinates
- [x] Customer Home map: show pulsing green dot + "Driver is on the way" + ETA in dark green overlay
- [x] Customer Home map: stop showing driver marker when driver goes offline or pickup completed
- [x] Verify TypeScript: 0 errors
- [x] Tests: 1053 passing (1054 total, 1 skipped)

## Two-Way Communication System (Customer ↔ Driver)

- [x] Extend PickupRequest type with driverPhone, assignedDriverName, driverVehicleType fields
- [x] Driver accept flow: write driver's name, phone, vehicleType into the pickup record on accept/in_progress
- [x] Build shared pickup chat screen (app/pickup-chat.tsx) with real-time polling every 3s
- [x] Chat uses @ltc_pickup_messages_{pickupId} storage key (same as driver chat screen)
- [x] Driver side: show customer contact card (name, phone, address) when pickup is accepted/in_progress
- [x] Driver side: Call Customer button (Linking.openURL tel:)
- [x] Driver side: SMS Customer button (Linking.openURL sms:)
- [x] Driver side: Chat Customer button (navigate to /pickup-chat with pickupId)
- [x] Customer side: show driver contact card (name, phone, vehicleType) when pickup is accepted/in_progress
- [x] Customer side: Call Driver button (Linking.openURL tel:)
- [x] Customer side: SMS Driver button (Linking.openURL sms:)
- [x] Customer side: Chat Driver button (navigate to /pickup-chat with pickupId)
- [x] Communication panel only shown for the driver assigned to that specific pickup
- [x] 20 unit tests for communication system (all passing)
- [x] TypeScript: 0 errors | Tests: 1073 passing

## Notification Bell on Customer Home Screen

- [x] Add userNotifications table to drizzle schema + created via direct SQL
- [x] Add DB helper functions: getUserNotifications, createUserNotification, markUserNotificationRead, markAllUserNotificationsRead
- [x] Add tRPC procedures: notifications.getAll, notifications.create, notifications.markRead, notifications.markAllRead
- [x] Replace Wallet button in top-right header with Notification Bell (dark green, #1B4332)
- [x] Add unread badge counter on bell (red circle, shows 99+ for large counts)
- [x] Bell polls backend every 30s for live unread count
- [x] Keep Wallet button in bottom navigation bar unchanged
- [x] Upgrade notifications.tsx to use live tRPC backend data (not local AsyncStorage)
- [x] Notifications screen polls every 15s for real-time updates
- [x] Support all 8 notification types: pickup_update, driver_accepted, driver_arriving, pickup_completed, payment, subscription, system, support
- [x] Mark single notification as read on tap
- [x] Mark all as read button in header
- [x] Tapping pickup-related notifications navigates to Pickups tab
- [x] Tapping payment notification navigates to payment-history
- [x] 17 unit tests for notification bell (all passing)
- [x] TypeScript: 0 errors | Tests: 1090 passing

## Android APK Compatibility Fixes

- [x] Fix 1: Add trpc.notifications stub entries (getAll, markRead, markAllRead, useUtils) to prevent crash on Android
- [x] Fix 2: Add CALL_PHONE permission to app.config.ts Android permissions for tel: links
- [x] Fix 3: Fix websocket-service.ts default URL from ws://localhost:3000 to empty string (localhost = device itself on Android)
- [x] Verified: all document.createElement calls are inside Platform.OS === 'web' guards (safe)
- [x] Verified: all window.* calls in auth.ts and manus-runtime.ts are web-only (safe)
- [x] Verified: GestureHandlerRootView wraps the app in _layout.tsx (correct)
- [x] Verified: react-native-maps uses PROVIDER_DEFAULT not PROVIDER_GOOGLE (no API key required at runtime)
- [x] Verified: KeyboardAvoidingView uses Platform.OS === 'ios' ? 'padding' : 'height' everywhere (correct for Android)
- [x] Verified: google-services.json package_name matches app bundle ID (correct)
- [x] Verified: All Android icon assets exist (foreground, background, monochrome)
- [x] TypeScript: 0 errors | Tests: 1090 passing (1091 total, 1 skipped)

## Zone Manager Dashboard Redesign

- [x] Add notification bell (top-right) with unread badge — reuses existing trpc.notifications infrastructure
- [x] Zone Overview: Total Households, Active Subscribers, Active Drivers, Total Pickups — live Supabase data
- [x] Revenue Analytics: Today's Revenue, Weekly Revenue, Monthly Revenue from subscription payments
- [x] Zone Live Map: driver GPS markers (yellow pin), customer pickup pins (blue), pending request markers (red)
- [x] Zone Live Map: real-time driver position updates (poll @ltc_driver_status every 5s)
- [x] Zone Live Map: web fallback showing driver/pickup counts when react-native-maps unavailable
- [x] Quick Action: Assign Driver — navigates to pickups screen with pending count subtitle
- [x] Quick Action: Approve Households — navigates to households screen
- [x] Quick Action: Driver Status — navigates to drivers screen with active driver count
- [x] Quick Action: Pickup Queue — navigates to pickups screen with pending count
- [x] Dashboard auto-refreshes every 30s for real-time updates
- [x] 23 unit tests for dashboard logic (all passing)
- [x] TypeScript: 0 errors

## Driver–Zone Manager Relationship Flow Fix

- [x] Audited driver registration, zone manager driver dashboard, invitation code system, and backend schema
- [x] Confirmed: registration already writes pending_manager_approval + zoneManagerId from invite code (working)
- [x] Fix 1: Zone manager drivers screen — added StorageEventBus.subscribe(USERS_DB) for real-time updates
- [x] Fix 2: handleApprove — added StorageEventBus.emit(USERS_DB) after AsyncStorage write
- [x] Fix 3: handleReject — added StorageEventBus.emit(USERS_DB) after AsyncStorage write
- [x] Fix 4: handleSuspend — added StorageEventBus.emit(USERS_DB) after AsyncStorage write
- [x] Fix 5: handleReactivate — added StorageEventBus.emit(USERS_DB) after AsyncStorage write
- [x] Fix 6: Driver layout guard — changed to allow pending drivers to stay in app (only reject/suspend redirected)
- [x] Fix 7: Driver home screen — pending drivers see full Awaiting Approval screen with auto-refresh indicator
- [x] Fix 8: Driver home screen — added StorageEventBus.subscribe(USERS_DB) to reload pickups on approval
- [x] 23 unit tests for driver-zone manager flow (all passing)
- [x] TypeScript: 0 errors

## Role-Based Redirect Logic Fix

- [x] Audited root _layout.tsx, auth-context.tsx, welcome screen, and all role routing
- [x] On app open: welcome screen already redirects all roles correctly (garbage_driver→/(garbage-driver), zone_manager→/(collector), recycler→/recycler-dashboard, others→/(tabs))
- [x] Fix 1: Added LOGOUT key to STORAGE_KEYS in storage-event-bus.ts
- [x] Fix 2: logout() in auth-context.tsx now emits StorageEventBus.emit(STORAGE_KEYS.LOGOUT) immediately
- [x] Fix 3: (tabs)/_layout.tsx — added LOGOUT subscription for immediate redirect to /(auth)/welcome
- [x] Fix 4: (tabs)/_layout.tsx — added garbage_driver case to role guard (redirects to /(garbage-driver))
- [x] Fix 5: (collector)/_layout.tsx — added LOGOUT subscription for immediate redirect to /(auth)/welcome
- [x] Fix 6: (garbage-driver)/_layout.tsx — added LOGOUT subscription for immediate redirect to /(auth)/welcome
- [x] Garbage driver pending_manager_approval → stays in driver pending screen (not welcome) — confirmed working
- [x] Garbage driver rejected/suspended → redirect to welcome screen — confirmed working
- [x] recycler-dashboard.tsx already handles null user → redirect (no change needed)
- [x] 17 unit tests for redirect logic (all passing)
- [x] TypeScript: 0 errors

## Session Persistence Splash Screen + Driver Notification Bell

- [x] Session persistence: SplashScreen.preventAutoHideAsync + role-check on first mount
- [x] On app open with valid session: redirect to correct role dashboard, hide splash
- [x] On app open without session: show welcome screen, hide splash
- [x] Add notification bell as 3rd button on driver dashboard header (after Route and Map)
- [x] Driver notification bell: unread badge counter
- [x] Driver notifications screen: list all driver notifications in real time
- [x] Wire zone manager approve/reject/assign actions to emit driver notifications (via shared notifications table)
- [x] Wire customer pickup request/cancel actions to emit driver notifications (via shared notifications table)
- [x] Driver notifications poll backend every 15s for real-time updates
- [x] Verify TypeScript: 0 errors
- [x] Save checkpoint

## Driver Notifications from Zone Manager + Customer Chat + Interactive Map

- [x] Zone manager approve driver → insert driver notification (driver_approved type)
- [x] Zone manager reject driver → insert driver notification (driver_suspended type)
- [x] Zone manager suspend driver → insert driver notification (driver_suspended type)
- [x] Zone manager assign pickup to driver → insert driver notification (pickup_assigned type)
- [x] Customer sends chat message → insert driver notification (customer_chat type) for assigned driver
- [x] Replace static MapView on customer home screen with interactive Google Maps (zoom/pan enabled)
- [x] Interactive map: scrollEnabled, zoomEnabled, pitchEnabled, rotateEnabled all true
- [x] Interactive map: preserve all existing logic (driver tracking, pins, polyline, overlay)
- [x] TypeScript: 0 errors
- [x] Save checkpoint

## Customer Map Recenter Button

- [x] Add floating Recenter button on customer home screen interactive map
- [x] Button calls mapRef.current.animateToRegion() to snap back to user's pinned location
- [x] Button positioned top-right corner of the map, above the overlay bar
- [x] Button shows compass/location icon, subtle shadow, white background
- [x] TypeScript: 0 errors
- [x] Save checkpoint

## Splash Screen Stuck Fix

- [x] Audit root _layout.tsx initialization chain
- [x] Audit AuthProvider for blocking operations
- [x] Implement 3-second hard timeout: always call SplashScreen.hideAsync() regardless of service state
- [x] Wrap auth load in Promise.race with 2s timeout in AuthProvider
- [x] Ensure auth check failure/timeout still navigates to welcome screen (isLoading=false → AuthGate fires → splash hides)
- [x] Ensure API/DB connection failure does not block splash (all service inits are fire-and-forget)
- [x] Add emergency fallback in RootLayout: SplashScreen.hideAsync() after 3s as last resort
- [x] Add external gate timeout in useFonts: 3s fallback if auth gate never resolves
- [x] TypeScript: 0 errors
- [x] Save checkpoint

## Global Real-Time Notification System

- [x] Audit current notification infrastructure and backend schema
- [x] Build GlobalNotificationProvider with polling, badge count, banner queue
- [x] Build InAppNotificationBanner floating toast component
- [x] Wire all 8 action triggers to send backend notifications
- [x] Customer creates pickup → notify zone manager
- [x] Zone manager assigns driver → notify driver + customer
- [x] Driver accepts pickup → notify customer
- [x] Driver arrives at location → notify customer
- [x] Pickup completed → notify customer
- [x] Subscription approved/rejected → notify customer
- [x] Payment confirmed → notify customer
- [x] Customer chat message → notify assigned driver
- [x] Bell badge works for all roles: customer, driver, zone manager, admin
- [x] Notifications appear on ALL screens (global provider in root layout)
- [x] TypeScript: 0 errors
- [x] Save checkpoint

## API Key Audit & Configuration

- [x] Audit Supabase initialization (lib/supabase.ts) for hardcoded keys
- [x] Audit Firebase initialization (lib/firebase.ts) for hardcoded keys
- [x] Audit Google Maps usage for hardcoded API keys
- [x] Audit MTN Mobile Money service for hardcoded keys
- [x] Audit Backend API base URL usage
- [x] Fix Supabase: graceful degradation when EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY missing
- [x] Fix Firebase: startup validation log for all 6 Firebase config env vars
- [x] Fix Google Maps: removed hardcoded AIzaSy key from map-display-screen.tsx → now reads EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
- [x] Fix MTN: getMtnMomoConfig accepts both server-side and frontend naming conventions as aliases
- [x] Fix Backend API: getApiBaseUrl() already reads EXPO_PUBLIC_API_BASE_URL correctly
- [x] Build startup API key validator (lib/api-key-validator.ts) with clear console report for all 5 services
- [x] logApiKeyReport() called once at app startup in RootLayout
- [x] Remove all hardcoded API keys from source files (1 found and fixed in map-display-screen.tsx)
- [x] TypeScript: 0 errors
- [x] Save checkpoint

## Notifications System Fix

- [x] Audit: root cause found — screens used tRPC stub (always returns null) instead of Supabase
- [x] Audit sendNotification: was calling backend tRPC HTTP endpoint (MySQL), not Supabase
- [x] Audit notifications screen: was calling trpc.notifications.getAll (stub, always empty)
- [x] Added Supabase SQL migration: supabase/migrations/20260307_notifications_table.sql
- [x] Rebuilt GlobalNotificationProvider: reads from Supabase with real-time subscription (channel)
- [x] Fixed sendNotification: now inserts directly into Supabase user_notifications table
- [x] Fixed customer notifications screen (app/notifications.tsx): uses GlobalNotificationProvider
- [x] Fixed driver notifications screen: uses GlobalNotificationProvider
- [x] Zone manager bell already used GlobalNotificationProvider (no screen change needed)
- [x] Mark notification as read on tap (read_status = true via Supabase update)
- [x] Badge counter updates via Supabase real-time subscription
- [x] TypeScript: 0 errors
- [x] Save checkpoint

## Production Cleanup — setTimeout & Math.random Audit

- [x] Fix report-issue.tsx setTimeout simulation → real AsyncStorage persistence
- [x] Fix affiliation-fee.tsx setTimeout simulation → direct state update
- [x] Fix recycler-payment.tsx setTimeout simulation wrapper → removed
- [x] Fix provider-earnings.tsx MOCK_ data → real useWithdrawals + useAuth data
- [x] Fix finance-commission.tsx generateMockData → real payments context data
- [x] Fix admin-withdrawals.tsx setTimeout simulation → direct state update
- [x] Fix payment.tsx setTimeout simulation → direct state update
- [x] Fix collector-dashboard.tsx Math.random distance → static placeholder
- [x] Fix carrier/track.tsx Math.random distance → deterministic Haversine formula
- [x] Fix carrier/book.tsx Math.random booking ID → Date.now() based ID
- [x] Fix pickup-chat.tsx Math.random message ID → Date.now() based ID
- [x] Fix collector-badge.tsx Math.random QR pattern → deterministic position-based pattern
- [x] Fix api-usage-analytics.tsx Math.random hourly traffic → deterministic bell curve
- [x] Fix admin-pickups-map.tsx setTimeout loading simulation → immediate setIsLoading(false)
- [x] Fix admin-geofencing.tsx setTimeout onRefresh → immediate setRefreshing(false)
- [x] Fix withdrawal-history.tsx setTimeout onRefresh → immediate setRefreshing(false)
- [x] TypeScript check: 0 errors confirmed
- [x] Save checkpoint

## Backend API Integration — Live Pickups

- [x] Create lib/pickup-api.ts — typed API client for GET /api/pickups and POST /api/pickups
- [x] Set EXPO_PUBLIC_PICKUP_API_BASE_URL env secret to https://ltc-fast-track-backend-production.up.railway.app
- [x] Rewrite lib/pickups-context.tsx — replace AsyncStorage with live API calls
- [x] Update app/request-pickup.tsx — POST to API on submit, no local storage
- [x] Update app/(tabs)/pickups.tsx — fetch from API, proper loading/error states
- [x] Update app/(tabs)/index.tsx — refresh pickups from API on focus
- [x] Remove all MOCK_ pickup arrays and Math.random pickup IDs
- [x] TypeScript: 0 errors
- [x] Save checkpoint

## Backend Production Rewrite — Apr 15 2026

- [x] Audit server/simple/index.ts — identify mock logic, missing routes, merge conflicts
- [x] Rewrite server/simple/index.ts — single clean production file, zero merge conflicts
- [x] SQLite schema — ensure all tables: users, wallets, transactions, linked_accounts, pickups
- [x] Real PawaPay integration — axios POST to api.sandbox.pawapay.io/v1/deposits
- [x] Phone prefix network detection — MTN (096/076), Airtel (097/077), Zamtel (095/075)
- [x] PawaPay callback route — POST /api/payments/pawapay/callback
- [x] Pickups CRUD — GET /api/pickups, POST /api/pickups, GET /api/pickups/:id, PATCH /api/pickups/:id
- [x] userId filter — GET /api/pickups?userId= query param support
- [x] Pickup status flow — pending → accepted → in_progress → completed with timestamps
- [x] Wallet, transactions, linked-accounts routes preserved
- [x] Server binds to 0.0.0.0 on process.env.PORT
- [x] Update server/tsconfig.json to include only simple/ directory
- [x] Install @types/express, @types/better-sqlite3, @types/cors
- [x] TypeScript: 0 errors on server/simple/index.ts
- [x] Live endpoint tests: health, GET/POST/PATCH pickups all pass
- [x] Set PAWAPAY_API_KEY secret (valid JWT, confirmed with PawaPay sandbox)
- [x] PawaPay key validation test: 2/2 passing
- [x] Save checkpoint

## Backend Improvements — Apr 15 2026 (Round 2)

- [x] GET /api/payments/:depositId/status — return transaction status, optionally verify with PawaPay
- [x] Upgrade withdrawals — PawaPay payouts API, deferred wallet deduction, failure handling
- [x] Env var validation — throw on startup if PAWAPAY_API_KEY is missing
- [x] Structured logging — payment requests, callback payloads, withdrawals
- [x] DB index on transactions.status column
- [x] TypeScript: 0 errors
- [x] Save checkpoint

## Multi-Country Registration — Apr 15 2026

- [x] Build lib/country-data.ts — Zambia + Tanzania provinces/regions/cities/towns JSON
- [x] Build lib/phone-utils.ts — country-aware validation and normalization
- [x] Update registration screen — country selector with flag, phone prefix, dynamic location dropdowns
- [x] Update backend user schema — add country, province, city, town columns (with idempotent ALTER TABLE migration)
- [x] Update backend phone normalization — Zambia 097→26097, Tanzania 07→2557 (toE164 country-aware)
- [x] Update PawaPay network detection — Tanzania Vodacom/Airtel/Tigo/Halotel prefixes
- [x] Payment + withdrawal routes use country from body/user record for currency + correspondent
- [x] Validation — require country, phoneNumber, province, city before submit
- [x] TypeScript: 0 errors (frontend + backend)
- [x] Save checkpoint

## API Base URL & userId Persistence Audit — Apr 15 2026

- [x] Audit all API call sites — find hardcoded URLs and userId patterns
- [x] Set EXPO_PUBLIC_API_URL secret pointing to production backend
- [x] Build lib/api-client.ts — single fetch wrapper using EXPO_PUBLIC_API_URL (no hardcoded URLs)
- [x] Build lib/user-session.ts — AsyncStorage userId persistence (getOrCreateBackendUserId)
- [x] Update lib/pickup-api.ts — use api-client (apiGet/apiPost/apiPatch)
- [x] Update lib/wallet-context.tsx — use api-client (no localhost fallback)
- [x] Update app/deposit.tsx — use api-client + getOrCreateBackendUserId
- [x] Update app/withdraw.tsx — use api-client + getOrCreateBackendUserId
- [x] Update app/link-account.tsx — use api-client + getOrCreateBackendUserId
- [x] Update app/(tabs)/wallet.tsx — fetch real transactions, use persisted backendUserId
- [x] Add POST /api/users to backend for idempotent user creation
- [x] Prevent duplicate user creation (backend: getOrCreateUser by phone; frontend: AsyncStorage cache)
- [x] TypeScript: 0 errors (frontend + backend)
- [x] Write tests/api-integration.test.ts — 9/9 passing
- [x] Save checkpoint
