/**
 * lib/firebase-crashlytics.ts
 *
 * Firebase Crashlytics integration for LTC Fast Track.
 *
 * Provides:
 *  - Global JS error handler setup
 *  - Promise rejection handler
 *  - User context setting (userId, role, province)
 *  - Manual error recording helpers
 *  - Breadcrumb logging for crash context
 */

import { crashlytics } from "./firebase";

// ─── Initialize global error handlers ────────────────────────────────────────

let _initialized = false;

/**
 * Initialize Crashlytics global error handlers.
 * Call once from app _layout.tsx.
 */
export function initCrashlytics(): void {
  if (_initialized) return;
  _initialized = true;

  // Override global error handler to capture unhandled JS errors
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    try {
      crashlytics.log(`[Global Error] isFatal=${String(isFatal)} — ${error.message}`);
      crashlytics.recordError(error, isFatal ? "FatalError" : "NonFatalError");
    } catch {}
    // Always call the original handler
    originalHandler(error, isFatal);
  });

  // Capture unhandled promise rejections
  const originalPromiseHandler = (global as Record<string, unknown>).onunhandledrejection as
    | ((event: PromiseRejectionEvent) => void)
    | undefined;

  (global as Record<string, unknown>).onunhandledrejection = (event: PromiseRejectionEvent) => {
    try {
      const reason = event.reason;
      const error = reason instanceof Error ? reason : new Error(String(reason));
      crashlytics.log(`[Unhandled Promise Rejection] ${error.message}`);
      crashlytics.recordError(error, "UnhandledPromiseRejection");
    } catch {}
    if (originalPromiseHandler) originalPromiseHandler(event);
  };

  if (__DEV__) {
    console.log("[Crashlytics] Global error handlers initialized.");
  }
}

// ─── User context ─────────────────────────────────────────────────────────────

/**
 * Set the current user context in Crashlytics.
 * Call after login/registration.
 */
export async function setCrashlyticsUser(params: {
  userId: string;
  role: string;
  province?: string;
  city?: string;
}): Promise<void> {
  await crashlytics.setUserId(params.userId);
  await crashlytics.setAttributes({
    role: params.role,
    province: params.province ?? "unknown",
    city: params.city ?? "unknown",
  });
}

/**
 * Clear user context on logout.
 */
export async function clearCrashlyticsUser(): Promise<void> {
  await crashlytics.setUserId("");
  await crashlytics.setAttributes({
    role: "",
    province: "",
    city: "",
  });
}

// ─── Manual error recording ───────────────────────────────────────────────────

/**
 * Record a non-fatal error with optional context.
 */
export function recordError(error: Error, context?: string): void {
  try {
    if (context) {
      crashlytics.log(`[Context] ${context}`);
    }
    crashlytics.recordError(error, context);
  } catch {}
}

/**
 * Record a non-fatal error from a caught exception (any type).
 */
export function recordException(exception: unknown, context?: string): void {
  const error = exception instanceof Error ? exception : new Error(String(exception));
  recordError(error, context);
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

/**
 * Log a breadcrumb message for crash context.
 * Appears in the Crashlytics dashboard alongside crash reports.
 */
export function logBreadcrumb(message: string): void {
  try {
    crashlytics.log(message);
  } catch {}
}

/**
 * Log a screen navigation breadcrumb.
 */
export function logScreenView(screenName: string): void {
  logBreadcrumb(`[Screen] ${screenName}`);
}

/**
 * Log a user action breadcrumb.
 */
export function logUserAction(action: string, details?: string): void {
  logBreadcrumb(`[Action] ${action}${details ? ` — ${details}` : ""}`);
}

// ─── Payment error recording ──────────────────────────────────────────────────

/**
 * Record a payment-related error with transaction context.
 */
export function recordPaymentError(error: Error, params: {
  transactionId?: string;
  amount?: number;
  paymentMethod?: string;
}): void {
  try {
    crashlytics.log(
      `[Payment Error] txn=${params.transactionId ?? "unknown"} amount=${params.amount ?? 0} method=${params.paymentMethod ?? "unknown"}`
    );
    crashlytics.recordError(error, "PaymentError");
  } catch {}
}
