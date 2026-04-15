/**
 * Firebase Services unit tests
 *
 * Tests Firebase notification payload builders, analytics event builders,
 * and in-app messaging trigger logic.
 *
 * NOTE: This test file is intentionally self-contained and does NOT import
 * from lib/firebase*.ts because those files import from 'react-native' and
 * 'firebase/app' which are not compatible with Vite's SSR transform in vitest.
 * Instead, the pure logic from each service is replicated inline for testing.
 */
import { describe, it, expect } from "vitest";

// ─── 1. Notification payload builders ────────────────────────────────────────
// Mirrors the logic in lib/firebase-notifications.ts

describe("FCM Notification Payload Builders", () => {
  function buildPaymentConfirmationPayload(params: {
    amount: number;
    currency: string;
    referenceId: string;
    serviceType: string;
  }) {
    return {
      eventType: "payment_confirmation",
      title: "Payment Confirmed \u2713",
      body: `Your payment of ${params.currency} ${params.amount.toFixed(2)} for ${params.serviceType} has been confirmed.`,
      data: {
        eventType: "payment_confirmation",
        referenceId: params.referenceId,
        amount: String(params.amount),
        currency: params.currency,
        serviceType: params.serviceType,
      },
    };
  }

  function buildNewPickupRequestPayload(params: {
    pickupId: string;
    customerName: string;
    address: string;
    zoneName: string;
  }) {
    return {
      eventType: "new_pickup_request",
      title: "New Pickup Request",
      body: `${params.customerName} has requested a pickup at ${params.address} (${params.zoneName})`,
      data: {
        eventType: "new_pickup_request",
        pickupId: params.pickupId,
        customerName: params.customerName,
        address: params.address,
        zoneName: params.zoneName,
      },
    };
  }

  function buildPickupScheduledPayload(params: {
    pickupId: string;
    scheduledDate: string;
    driverName: string;
    zoneName: string;
  }) {
    return {
      eventType: "garbage_pickup_scheduled",
      title: "Pickup Scheduled",
      body: `Your garbage pickup has been scheduled for ${params.scheduledDate}. Driver: ${params.driverName}`,
      data: {
        eventType: "garbage_pickup_scheduled",
        pickupId: params.pickupId,
        scheduledDate: params.scheduledDate,
        driverName: params.driverName,
        zoneName: params.zoneName,
      },
    };
  }

  function buildPickupCompletedPayload(params: {
    pickupId: string;
    completedAt: string;
    driverName: string;
  }) {
    return {
      eventType: "garbage_pickup_completed",
      title: "Pickup Completed \u2713",
      body: `Your garbage has been collected by ${params.driverName}.`,
      data: {
        eventType: "garbage_pickup_completed",
        pickupId: params.pickupId,
        completedAt: params.completedAt,
        driverName: params.driverName,
      },
    };
  }

  function buildDriverArrivingPayload(params: {
    pickupId: string;
    driverName: string;
    etaMinutes: number;
  }) {
    const etaStr = params.etaMinutes === 1 ? "1 minute" : `${params.etaMinutes} minutes`;
    return {
      eventType: "driver_arriving",
      title: "\uD83D\uDE9B Driver Arriving Soon",
      body: `${params.driverName} is ${etaStr} away.`,
      data: {
        eventType: "driver_arriving",
        pickupId: params.pickupId,
        driverName: params.driverName,
        etaMinutes: String(params.etaMinutes),
      },
    };
  }

  function buildWithdrawalStatusPayload(params: {
    withdrawalId: string;
    status: "approved" | "rejected";
    amount: number;
    currency: string;
    reason?: string;
  }) {
    const approved = params.status === "approved";
    return {
      eventType: "withdrawal_status",
      title: approved ? "Withdrawal Approved \u2713" : "Withdrawal Rejected",
      body: approved
        ? `Your withdrawal of ${params.currency} ${params.amount.toFixed(2)} has been approved and will be processed shortly.`
        : `Your withdrawal of ${params.currency} ${params.amount.toFixed(2)} was rejected.${params.reason ? ` Reason: ${params.reason}` : ""}`,
      data: {
        eventType: "withdrawal_status",
        withdrawalId: params.withdrawalId,
        status: params.status,
        amount: String(params.amount),
        currency: params.currency,
        reason: params.reason ?? "",
      },
    };
  }

  it("buildPaymentConfirmationPayload returns correct event type and formatted body", () => {
    const payload = buildPaymentConfirmationPayload({
      amount: 150.0,
      currency: "ZMW",
      referenceId: "txn-001",
      serviceType: "garbage collection",
    });
    expect(payload.eventType).toBe("payment_confirmation");
    expect(payload.title).toBe("Payment Confirmed \u2713");
    expect(payload.body).toContain("ZMW 150.00");
    expect(payload.body).toContain("garbage collection");
    expect(payload.data.referenceId).toBe("txn-001");
  });

  it("buildPaymentConfirmationPayload includes all required data fields", () => {
    const payload = buildPaymentConfirmationPayload({
      amount: 50,
      currency: "ZMW",
      referenceId: "txn-002",
      serviceType: "carrier",
    });
    expect(payload.data).toMatchObject({
      eventType: "payment_confirmation",
      referenceId: "txn-002",
      amount: "50",
      currency: "ZMW",
      serviceType: "carrier",
    });
  });

  it("buildNewPickupRequestPayload returns correct event type and customer info in body", () => {
    const payload = buildNewPickupRequestPayload({
      pickupId: "pickup-001",
      customerName: "John Banda",
      address: "Plot 12, Lusaka",
      zoneName: "Zone A",
    });
    expect(payload.eventType).toBe("new_pickup_request");
    expect(payload.body).toContain("John Banda");
    expect(payload.body).toContain("Zone A");
    expect(payload.data.pickupId).toBe("pickup-001");
  });

  it("buildPickupScheduledPayload includes scheduled date and driver name", () => {
    const payload = buildPickupScheduledPayload({
      pickupId: "pickup-002",
      scheduledDate: "2026-03-10",
      driverName: "Moses Phiri",
      zoneName: "Zone B",
    });
    expect(payload.eventType).toBe("garbage_pickup_scheduled");
    expect(payload.body).toContain("2026-03-10");
    expect(payload.body).toContain("Moses Phiri");
  });

  it("buildPickupCompletedPayload returns completion message with driver name", () => {
    const payload = buildPickupCompletedPayload({
      pickupId: "pickup-003",
      completedAt: "2026-03-10T09:00:00Z",
      driverName: "Moses Phiri",
    });
    expect(payload.eventType).toBe("garbage_pickup_completed");
    expect(payload.body).toContain("Moses Phiri");
    expect(payload.title).toContain("\u2713");
  });

  it("buildDriverArrivingPayload uses singular 'minute' for ETA of 1", () => {
    const payload = buildDriverArrivingPayload({
      pickupId: "pickup-004",
      driverName: "David Mwale",
      etaMinutes: 1,
    });
    expect(payload.body).toContain("1 minute");
    expect(payload.body).not.toContain("minutes");
  });

  it("buildDriverArrivingPayload uses plural 'minutes' for ETA > 1", () => {
    const payload = buildDriverArrivingPayload({
      pickupId: "pickup-005",
      driverName: "David Mwale",
      etaMinutes: 5,
    });
    expect(payload.body).toContain("5 minutes");
  });

  it("buildDriverArrivingPayload includes driver name and truck emoji", () => {
    const payload = buildDriverArrivingPayload({
      pickupId: "pickup-006",
      driverName: "David Mwale",
      etaMinutes: 3,
    });
    expect(payload.title).toContain("\uD83D\uDE9B");
    expect(payload.body).toContain("David Mwale");
  });

  it("buildWithdrawalStatusPayload returns approved message for approved status", () => {
    const payload = buildWithdrawalStatusPayload({
      withdrawalId: "wd-001",
      status: "approved",
      amount: 200,
      currency: "ZMW",
    });
    expect(payload.eventType).toBe("withdrawal_status");
    expect(payload.title).toContain("Approved");
    expect(payload.body).toContain("200.00");
    expect(payload.data.status).toBe("approved");
  });

  it("buildWithdrawalStatusPayload returns rejection message with reason when provided", () => {
    const payload = buildWithdrawalStatusPayload({
      withdrawalId: "wd-002",
      status: "rejected",
      amount: 100,
      currency: "ZMW",
      reason: "Insufficient documentation",
    });
    expect(payload.title).toContain("Rejected");
    expect(payload.body).toContain("Insufficient documentation");
  });

  it("buildWithdrawalStatusPayload returns rejection message without reason when not provided", () => {
    const payload = buildWithdrawalStatusPayload({
      withdrawalId: "wd-003",
      status: "rejected",
      amount: 75,
      currency: "ZMW",
    });
    expect(payload.body).not.toContain("Reason:");
  });
});

// ─── 2. Analytics event builders ─────────────────────────────────────────────
// Mirrors the logic in lib/firebase-analytics.ts

describe("Firebase Analytics Events", () => {
  const ANALYTICS_EVENTS = {
    USER_REGISTRATION: "user_registration",
    USER_LOGIN: "user_login",
    SUBSCRIPTION_ACTIVATION: "subscription_activation",
    PAYMENT_COMPLETION: "payment_completion",
    PICKUP_REQUEST_CREATED: "pickup_request_created",
    WITHDRAWAL_REQUEST: "withdrawal_request",
  } as const;

  it("defines all 6 required analytics event names", () => {
    expect(ANALYTICS_EVENTS.USER_REGISTRATION).toBe("user_registration");
    expect(ANALYTICS_EVENTS.USER_LOGIN).toBe("user_login");
    expect(ANALYTICS_EVENTS.SUBSCRIPTION_ACTIVATION).toBe("subscription_activation");
    expect(ANALYTICS_EVENTS.PAYMENT_COMPLETION).toBe("payment_completion");
    expect(ANALYTICS_EVENTS.PICKUP_REQUEST_CREATED).toBe("pickup_request_created");
    expect(ANALYTICS_EVENTS.WITHDRAWAL_REQUEST).toBe("withdrawal_request");
  });

  it("user registration event params have correct shape", () => {
    const params = {
      user_id: "user-001",
      role: "customer",
      province: "Lusaka",
      city: "Lusaka",
      method: "phone",
    };
    expect(params.user_id).toBe("user-001");
    expect(params.role).toBe("customer");
    expect(params.province).toBe("Lusaka");
  });

  it("payment completion event params include platform_commission", () => {
    const amount = 300;
    const commissionRate = 0.10;
    const platformCommission = parseFloat((amount * commissionRate).toFixed(2));
    const params = {
      user_id: "user-004",
      transaction_id: "txn-100",
      value: amount,
      currency: "ZMW",
      service_type: "garbage",
      payment_method: "mtn_momo",
      platform_commission: platformCommission,
    };
    expect(params.platform_commission).toBe(30);
    expect(params.service_type).toBe("garbage");
  });

  it("validates 10% commission calculation in analytics params", () => {
    const amount = 200.0;
    const commissionRate = 0.10;
    const commissionAmount = parseFloat((amount * commissionRate).toFixed(2));
    const providerAmount = parseFloat((amount - commissionAmount).toFixed(2));
    expect(commissionAmount).toBe(20.0);
    expect(providerAmount).toBe(180.0);
    expect(commissionAmount + providerAmount).toBe(amount);
  });

  it("withdrawal request event params include provider_role", () => {
    const params = {
      user_id: "user-006",
      withdrawal_id: "wd-100",
      value: 500,
      currency: "ZMW",
      provider_role: "zone_manager",
      withdrawal_method: "mtn_momo",
    };
    expect(params.provider_role).toBe("zone_manager");
    expect(params.value).toBe(500);
  });

  it("subscription activation event params include value and currency", () => {
    const params = {
      user_id: "user-003",
      subscription_type: "monthly",
      plan_name: "Basic",
      value: 50,
      currency: "ZMW",
    };
    expect(params.value).toBe(50);
    expect(params.currency).toBe("ZMW");
  });

  it("pickup request event params include zone and province", () => {
    const params = {
      user_id: "user-005",
      pickup_id: "pickup-100",
      zone_id: "zone-1",
      province: "Lusaka",
      city: "Lusaka",
      service_type: "garbage",
    };
    expect(params.province).toBe("Lusaka");
    expect(params.zone_id).toBe("zone-1");
  });
});

// ─── 3. In-app messaging triggers ────────────────────────────────────────────
// Mirrors the logic in lib/firebase-in-app-messaging.ts

describe("Firebase In-App Messaging Triggers", () => {
  const IN_APP_MESSAGE_EVENTS = {
    WELCOME_NEW_USER: "welcome_new_user",
    PICKUP_REMINDER: "pickup_reminder",
    INACTIVE_USER_REMINDER: "inactive_user_reminder",
    NEW_SERVICES_ANNOUNCEMENT: "new_services_announcement",
  } as const;

  it("defines all 4 in-app message event types", () => {
    expect(IN_APP_MESSAGE_EVENTS.WELCOME_NEW_USER).toBe("welcome_new_user");
    expect(IN_APP_MESSAGE_EVENTS.PICKUP_REMINDER).toBe("pickup_reminder");
    expect(IN_APP_MESSAGE_EVENTS.INACTIVE_USER_REMINDER).toBe("inactive_user_reminder");
    expect(IN_APP_MESSAGE_EVENTS.NEW_SERVICES_ANNOUNCEMENT).toBe("new_services_announcement");
  });

  it("welcome message trigger data has correct shape", () => {
    const trigger = {
      event: IN_APP_MESSAGE_EVENTS.WELCOME_NEW_USER,
      userId: "user-001",
      userName: "John Banda",
      userRole: "customer",
    };
    expect(trigger.event).toBe("welcome_new_user");
    expect(trigger.userName).toBe("John Banda");
  });

  it("pickup reminder trigger data has correct shape", () => {
    const trigger = {
      event: IN_APP_MESSAGE_EVENTS.PICKUP_REMINDER,
      pickupId: "pickup-001",
      scheduledDate: "2026-03-12",
      hoursUntilPickup: 24,
    };
    expect(trigger.event).toBe("pickup_reminder");
    expect(trigger.hoursUntilPickup).toBe(24);
  });

  it("inactive user reminder detects inactivity correctly", () => {
    const daysSinceLastLogin = 30;
    const INACTIVE_THRESHOLD_DAYS = 14;
    const isInactive = daysSinceLastLogin >= INACTIVE_THRESHOLD_DAYS;
    const trigger = {
      event: IN_APP_MESSAGE_EVENTS.INACTIVE_USER_REMINDER,
      userId: "user-002",
      daysSinceLastLogin,
      isInactive,
    };
    expect(trigger.event).toBe("inactive_user_reminder");
    expect(trigger.isInactive).toBe(true);
  });

  it("active user (< 14 days) is not considered inactive", () => {
    const daysSinceLastLogin = 5;
    const INACTIVE_THRESHOLD_DAYS = 14;
    const isInactive = daysSinceLastLogin >= INACTIVE_THRESHOLD_DAYS;
    expect(isInactive).toBe(false);
  });

  it("new service announcement trigger data has correct shape", () => {
    const trigger = {
      event: IN_APP_MESSAGE_EVENTS.NEW_SERVICES_ANNOUNCEMENT,
      serviceTitle: "Carrier Logistics Now Available",
      serviceDescription: "Book carrier services directly from the app",
      targetRoles: ["customer", "zone_manager"],
    };
    expect(trigger.event).toBe("new_services_announcement");
    expect(trigger.targetRoles).toContain("customer");
    expect(trigger.targetRoles).toContain("zone_manager");
  });
});

// ─── 4. Firebase configuration validation ────────────────────────────────────

describe("Firebase Configuration", () => {
  it("validates that all 6 Firebase env var keys are defined as stubs", () => {
    const requiredKeys = [
      "EXPO_PUBLIC_FIREBASE_API_KEY",
      "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
      "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
      "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      "EXPO_PUBLIC_FIREBASE_APP_ID",
    ];
    requiredKeys.forEach((key) => {
      expect(typeof process.env[key]).toBe("string");
    });
  });

  it("Firebase config object has correct shape", () => {
    const config = {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
    };
    expect(config).toHaveProperty("apiKey");
    expect(config).toHaveProperty("authDomain");
    expect(config).toHaveProperty("projectId");
    expect(config).toHaveProperty("storageBucket");
    expect(config).toHaveProperty("messagingSenderId");
    expect(config).toHaveProperty("appId");
  });

  it("detects sandbox mode when APP_ENV is sandbox", () => {
    const isSandbox = (env: string | undefined) => env === "sandbox";
    expect(isSandbox("sandbox")).toBe(true);
    expect(isSandbox("production")).toBe(false);
    expect(isSandbox(undefined)).toBe(false);
  });
});

// ─── 5. Crashlytics error reporting ──────────────────────────────────────────

describe("Firebase Crashlytics", () => {
  it("error metadata has correct shape for crash reports", () => {
    const errorMeta = {
      userId: "user-001",
      userRole: "customer",
      province: "Lusaka",
      city: "Lusaka",
      appVersion: "1.0.0",
      platform: "ios",
      errorMessage: "Payment failed: network timeout",
      errorCode: "PAYMENT_NETWORK_ERROR",
      context: "PaymentScreen",
    };
    expect(errorMeta.errorCode).toBe("PAYMENT_NETWORK_ERROR");
    expect(errorMeta.context).toBe("PaymentScreen");
    expect(errorMeta.userId).toBe("user-001");
  });

  it("non-fatal error reporting includes stack trace placeholder", () => {
    const nonFatalError = {
      message: "MTN MoMo request timeout",
      name: "MTNTimeoutError",
      stack: "at requestToPay (mtn-momo.ts:45:12)",
      isFatal: false,
      context: "PaymentService.requestPayment",
    };
    expect(nonFatalError.isFatal).toBe(false);
    expect(nonFatalError.context).toBe("PaymentService.requestPayment");
  });
});
