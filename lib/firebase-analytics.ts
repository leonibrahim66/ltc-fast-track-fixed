/**
 * lib/firebase-analytics.ts
 *
 * Firebase Analytics event tracking service for LTC Fast Track.
 *
 * Tracked events:
 *  1. user_registration         — New user registers
 *  2. user_login                — User logs in
 *  3. subscription_activation   — User activates a subscription
 *  4. payment_completion        — Payment successfully completed
 *  5. pickup_request_created    — Pickup request submitted
 *  6. withdrawal_request        — Provider requests a withdrawal
 *
 * All events are no-ops when Firebase is unconfigured or on web.
 */

import { analytics } from "./firebase";

// ─── Event name constants ─────────────────────────────────────────────────────

export const ANALYTICS_EVENTS = {
  USER_REGISTRATION: "user_registration",
  USER_LOGIN: "user_login",
  SUBSCRIPTION_ACTIVATION: "subscription_activation",
  PAYMENT_COMPLETION: "payment_completion",
  PICKUP_REQUEST_CREATED: "pickup_request_created",
  WITHDRAWAL_REQUEST: "withdrawal_request",
} as const;

// ─── Event 1: User Registration ───────────────────────────────────────────────

export interface UserRegistrationParams {
  userId: string;
  role: string;
  province?: string;
  city?: string;
  method?: "phone" | "email";
}

export async function trackUserRegistration(params: UserRegistrationParams): Promise<void> {
  await analytics.setUserId(params.userId);
  await analytics.setUserProperties({
    user_role: params.role,
    province: params.province ?? null,
    city: params.city ?? null,
  });
  await analytics.logEvent(ANALYTICS_EVENTS.USER_REGISTRATION, {
    user_id: params.userId,
    role: params.role,
    province: params.province ?? "unknown",
    city: params.city ?? "unknown",
    method: params.method ?? "phone",
  });
}

// ─── Event 2: User Login ──────────────────────────────────────────────────────

export interface UserLoginParams {
  userId: string;
  role: string;
  method?: "phone" | "email" | "biometric";
}

export async function trackUserLogin(params: UserLoginParams): Promise<void> {
  await analytics.setUserId(params.userId);
  await analytics.logEvent(ANALYTICS_EVENTS.USER_LOGIN, {
    user_id: params.userId,
    role: params.role,
    method: params.method ?? "phone",
  });
}

// ─── Event 3: Subscription Activation ────────────────────────────────────────

export interface SubscriptionActivationParams {
  userId: string;
  subscriptionType: string;
  planName: string;
  amount: number;
  currency: string;
  zoneId?: string;
}

export async function trackSubscriptionActivation(
  params: SubscriptionActivationParams
): Promise<void> {
  await analytics.logEvent(ANALYTICS_EVENTS.SUBSCRIPTION_ACTIVATION, {
    user_id: params.userId,
    subscription_type: params.subscriptionType,
    plan_name: params.planName,
    value: params.amount,
    currency: params.currency,
    zone_id: params.zoneId ?? "unknown",
  });
}

// ─── Event 4: Payment Completion ──────────────────────────────────────────────

export interface PaymentCompletionParams {
  userId: string;
  transactionId: string;
  amount: number;
  currency: string;
  serviceType: "garbage" | "carrier" | "subscription";
  paymentMethod: string;
  platformCommission: number;
}

export async function trackPaymentCompletion(params: PaymentCompletionParams): Promise<void> {
  await analytics.logEvent(ANALYTICS_EVENTS.PAYMENT_COMPLETION, {
    user_id: params.userId,
    transaction_id: params.transactionId,
    value: params.amount,
    currency: params.currency,
    service_type: params.serviceType,
    payment_method: params.paymentMethod,
    platform_commission: params.platformCommission,
  });
}

// ─── Event 5: Pickup Request Created ─────────────────────────────────────────

export interface PickupRequestCreatedParams {
  userId: string;
  pickupId: string;
  zoneId?: string;
  province?: string;
  city?: string;
  serviceType?: string;
}

export async function trackPickupRequestCreated(
  params: PickupRequestCreatedParams
): Promise<void> {
  await analytics.logEvent(ANALYTICS_EVENTS.PICKUP_REQUEST_CREATED, {
    user_id: params.userId,
    pickup_id: params.pickupId,
    zone_id: params.zoneId ?? "unknown",
    province: params.province ?? "unknown",
    city: params.city ?? "unknown",
    service_type: params.serviceType ?? "garbage",
  });
}

// ─── Event 6: Withdrawal Request ─────────────────────────────────────────────

export interface WithdrawalRequestParams {
  userId: string;
  withdrawalId: string;
  amount: number;
  currency: string;
  providerRole: "zone_manager" | "carrier_driver";
  withdrawalMethod: string;
}

export async function trackWithdrawalRequest(params: WithdrawalRequestParams): Promise<void> {
  await analytics.logEvent(ANALYTICS_EVENTS.WITHDRAWAL_REQUEST, {
    user_id: params.userId,
    withdrawal_id: params.withdrawalId,
    value: params.amount,
    currency: params.currency,
    provider_role: params.providerRole,
    withdrawal_method: params.withdrawalMethod,
  });
}

// ─── Identify user (call after login/registration) ────────────────────────────

export async function identifyUser(params: {
  userId: string;
  role: string;
  province?: string;
  city?: string;
}): Promise<void> {
  await analytics.setUserId(params.userId);
  await analytics.setUserProperties({
    user_role: params.role,
    province: params.province ?? null,
    city: params.city ?? null,
  });
}

// ─── Clear user identity (call on logout) ─────────────────────────────────────

export async function clearAnalyticsUser(): Promise<void> {
  await analytics.setUserId(null);
  await analytics.setUserProperties({
    user_role: null,
    province: null,
    city: null,
  });
}
