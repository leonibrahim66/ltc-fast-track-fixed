/**
 * lib/firebase.ts
 *
 * Central Firebase initialization module for LTC Fast Track.
 *
 * Services exported:
 *  - firebaseApp       → initialized Firebase app instance
 *  - messaging         → Firebase Cloud Messaging (push notifications)
 *  - analytics         → Firebase Analytics (event tracking)
 *  - crashlytics       → Firebase Crashlytics (crash reporting)
 *  - inAppMessaging    → Firebase In-App Messaging (contextual prompts)
 *
 * All services are initialized lazily and guarded against web/server environments
 * where native Firebase SDKs are unavailable.
 *
 * Configuration is read exclusively from EXPO_PUBLIC_FIREBASE_* environment variables.
 * Values are NEVER hardcoded here.
 */

import { Platform } from "react-native";
import { initializeApp, getApps, getApp } from "firebase/app";

// ─── Firebase config from environment variables ───────────────────────────────

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

// ─── Validate config ──────────────────────────────────────────────────────────

export function isFirebaseConfigured(): boolean {
  return (
    firebaseConfig.apiKey.length > 0 &&
    firebaseConfig.projectId.length > 0 &&
    firebaseConfig.appId.length > 0
  );
}

// ─── Startup validation log ─────────────────────────────────────────────────
if (__DEV__) {
  const missing = [
    !firebaseConfig.apiKey && "EXPO_PUBLIC_FIREBASE_API_KEY",
    !firebaseConfig.authDomain && "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    !firebaseConfig.projectId && "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    !firebaseConfig.storageBucket && "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    !firebaseConfig.messagingSenderId && "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    !firebaseConfig.appId && "EXPO_PUBLIC_FIREBASE_APP_ID",
  ].filter(Boolean);
  if (missing.length > 0) {
    console.warn(
      `[Firebase] ⚠️  Missing ${missing.length} env var(s) — push notifications and analytics will be disabled:\n` +
        missing.map((k) => `    ${k}`).join("\n")
    );
  } else {
    console.log("[Firebase] ✅ All config keys present — services will initialize on native.");
  }
}

// ─── Initialize Firebase app (singleton) ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _app: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFirebaseApp(): any {
  if (!isFirebaseConfigured()) {
    if (__DEV__) {
      console.warn("[Firebase] Not configured — set EXPO_PUBLIC_FIREBASE_* env vars.");
    }
    return null;
  }
  try {
    _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return _app;
  } catch (error) {
    console.error("[Firebase] Initialization error:", error);
    return null;
  }
}

export const firebaseApp = getFirebaseApp();

// ─── Messaging (FCM) ──────────────────────────────────────────────────────────
// React Native Firebase messaging — only available on iOS/Android native builds.
// On web or when unconfigured, returns a null-safe stub.

export type MessagingService = {
  getToken: () => Promise<string | null>;
  onMessage: (handler: (message: FirebaseMessage) => void) => () => void;
  onNotificationOpenedApp: (handler: (message: FirebaseMessage) => void) => () => void;
  getInitialNotification: () => Promise<FirebaseMessage | null>;
  setBackgroundMessageHandler: (handler: (message: FirebaseMessage) => Promise<void>) => void;
  requestPermission: () => Promise<boolean>;
};

export type FirebaseMessage = {
  messageId?: string;
  notification?: {
    title?: string;
    body?: string;
    imageUrl?: string;
  };
  data?: Record<string, string>;
  sentTime?: number;
};

function createMessagingStub(): MessagingService {
  return {
    getToken: async () => null,
    onMessage: () => () => {},
    onNotificationOpenedApp: () => () => {},
    getInitialNotification: async () => null,
    setBackgroundMessageHandler: () => {},
    requestPermission: async () => false,
  };
}

let _messaging: MessagingService | null = null;

export function getMessaging(): MessagingService {
  if (_messaging) return _messaging;

  if (Platform.OS === "web" || !isFirebaseConfigured()) {
    _messaging = createMessagingStub();
    return _messaging;
  }

  try {
    // Dynamic import to avoid web bundler errors
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnfMessaging = require("@react-native-firebase/messaging").default;
    _messaging = {
      getToken: async () => {
        try {
          return await rnfMessaging().getToken();
        } catch {
          return null;
        }
      },
      onMessage: (handler) => {
        return rnfMessaging().onMessage(async (remoteMessage: FirebaseMessage) => {
          handler(remoteMessage);
        });
      },
      onNotificationOpenedApp: (handler) => {
        return rnfMessaging().onNotificationOpenedApp(async (remoteMessage: FirebaseMessage) => {
          handler(remoteMessage);
        });
      },
      getInitialNotification: async () => {
        return rnfMessaging().getInitialNotification();
      },
      setBackgroundMessageHandler: (handler) => {
        rnfMessaging().setBackgroundMessageHandler(handler);
      },
      requestPermission: async () => {
        try {
          const authStatus = await rnfMessaging().requestPermission();
          return (
            authStatus === rnfMessaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === rnfMessaging.AuthorizationStatus.PROVISIONAL
          );
        } catch {
          return false;
        }
      },
    };
  } catch {
    if (__DEV__) {
      console.warn("[Firebase] Messaging unavailable — using stub.");
    }
    _messaging = createMessagingStub();
  }

  return _messaging;
}

export const messaging = getMessaging();

// ─── Analytics ────────────────────────────────────────────────────────────────

export type AnalyticsService = {
  logEvent: (eventName: string, params?: Record<string, unknown>) => Promise<void>;
  setUserId: (userId: string | null) => Promise<void>;
  setUserProperties: (properties: Record<string, string | null>) => Promise<void>;
  setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
};

function createAnalyticsStub(): AnalyticsService {
  return {
    logEvent: async () => {},
    setUserId: async () => {},
    setUserProperties: async () => {},
    setAnalyticsCollectionEnabled: async () => {},
  };
}

let _analytics: AnalyticsService | null = null;

export function getAnalytics(): AnalyticsService {
  if (_analytics) return _analytics;

  if (Platform.OS === "web" || !isFirebaseConfigured()) {
    _analytics = createAnalyticsStub();
    return _analytics;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnfAnalytics = require("@react-native-firebase/analytics").default;
    _analytics = {
      logEvent: async (eventName, params) => {
        try {
          await rnfAnalytics().logEvent(eventName, params);
        } catch (e) {
          if (__DEV__) console.warn("[Firebase Analytics] logEvent error:", e);
        }
      },
      setUserId: async (userId) => {
        try {
          await rnfAnalytics().setUserId(userId);
        } catch (e) {
          if (__DEV__) console.warn("[Firebase Analytics] setUserId error:", e);
        }
      },
      setUserProperties: async (properties) => {
        try {
          await rnfAnalytics().setUserProperties(properties);
        } catch (e) {
          if (__DEV__) console.warn("[Firebase Analytics] setUserProperties error:", e);
        }
      },
      setAnalyticsCollectionEnabled: async (enabled) => {
        try {
          await rnfAnalytics().setAnalyticsCollectionEnabled(enabled);
        } catch (e) {
          if (__DEV__) console.warn("[Firebase Analytics] setAnalyticsCollectionEnabled error:", e);
        }
      },
    };
  } catch {
    if (__DEV__) {
      console.warn("[Firebase] Analytics unavailable — using stub.");
    }
    _analytics = createAnalyticsStub();
  }

  return _analytics;
}

export const analytics = getAnalytics();

// ─── Crashlytics ──────────────────────────────────────────────────────────────

export type CrashlyticsService = {
  recordError: (error: Error, jsErrorName?: string) => void;
  log: (message: string) => void;
  setUserId: (userId: string) => Promise<void>;
  setAttribute: (name: string, value: string) => Promise<void>;
  setAttributes: (attributes: Record<string, string>) => Promise<void>;
  setCrashlyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
  crash: () => void;
};

function createCrashlyticsStub(): CrashlyticsService {
  return {
    recordError: (error) => {
      if (__DEV__) console.error("[Crashlytics stub] Error recorded:", error);
    },
    log: (message) => {
      if (__DEV__) console.log("[Crashlytics stub]", message);
    },
    setUserId: async () => {},
    setAttribute: async () => {},
    setAttributes: async () => {},
    setCrashlyticsCollectionEnabled: async () => {},
    crash: () => {
      if (__DEV__) console.warn("[Crashlytics stub] crash() called");
    },
  };
}

let _crashlytics: CrashlyticsService | null = null;

export function getCrashlytics(): CrashlyticsService {
  if (_crashlytics) return _crashlytics;

  if (Platform.OS === "web" || !isFirebaseConfigured()) {
    _crashlytics = createCrashlyticsStub();
    return _crashlytics;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnfCrashlytics = require("@react-native-firebase/crashlytics").default;
    _crashlytics = {
      recordError: (error, jsErrorName) => {
        try {
          rnfCrashlytics().recordError(error, jsErrorName);
        } catch (e) {
          if (__DEV__) console.warn("[Crashlytics] recordError failed:", e);
        }
      },
      log: (message) => {
        try {
          rnfCrashlytics().log(message);
        } catch {}
      },
      setUserId: async (userId) => {
        try {
          await rnfCrashlytics().setUserId(userId);
        } catch {}
      },
      setAttribute: async (name, value) => {
        try {
          await rnfCrashlytics().setAttribute(name, value);
        } catch {}
      },
      setAttributes: async (attributes) => {
        try {
          await rnfCrashlytics().setAttributes(attributes);
        } catch {}
      },
      setCrashlyticsCollectionEnabled: async (enabled) => {
        try {
          await rnfCrashlytics().setCrashlyticsCollectionEnabled(enabled);
        } catch {}
      },
      crash: () => {
        try {
          rnfCrashlytics().crash();
        } catch {}
      },
    };
  } catch {
    if (__DEV__) {
      console.warn("[Firebase] Crashlytics unavailable — using stub.");
    }
    _crashlytics = createCrashlyticsStub();
  }

  return _crashlytics;
}

export const crashlytics = getCrashlytics();

// ─── In-App Messaging ─────────────────────────────────────────────────────────

export type InAppMessagingService = {
  isMessagesDisplaySuppressed: () => Promise<boolean>;
  setMessagesDisplaySuppressed: (suppressed: boolean) => Promise<void>;
  isAutomaticDataCollectionEnabled: () => Promise<boolean>;
  setAutomaticDataCollectionEnabled: (enabled: boolean) => Promise<void>;
  triggerEvent: (eventId: string) => Promise<void>;
};

function createInAppMessagingStub(): InAppMessagingService {
  return {
    isMessagesDisplaySuppressed: async () => false,
    setMessagesDisplaySuppressed: async () => {},
    isAutomaticDataCollectionEnabled: async () => false,
    setAutomaticDataCollectionEnabled: async () => {},
    triggerEvent: async (eventId) => {
      if (__DEV__) console.log("[InAppMessaging stub] triggerEvent:", eventId);
    },
  };
}

let _inAppMessaging: InAppMessagingService | null = null;

export function getInAppMessaging(): InAppMessagingService {
  if (_inAppMessaging) return _inAppMessaging;

  if (Platform.OS === "web" || !isFirebaseConfigured()) {
    _inAppMessaging = createInAppMessagingStub();
    return _inAppMessaging;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnfInAppMessaging = require("@react-native-firebase/in-app-messaging").default;
    _inAppMessaging = {
      isMessagesDisplaySuppressed: async () => {
        try {
          return await rnfInAppMessaging().isMessagesDisplaySuppressed;
        } catch {
          return false;
        }
      },
      setMessagesDisplaySuppressed: async (suppressed) => {
        try {
          await rnfInAppMessaging().setMessagesDisplaySuppressed(suppressed);
        } catch {}
      },
      isAutomaticDataCollectionEnabled: async () => {
        try {
          return await rnfInAppMessaging().isAutomaticDataCollectionEnabled;
        } catch {
          return false;
        }
      },
      setAutomaticDataCollectionEnabled: async (enabled) => {
        try {
          await rnfInAppMessaging().setAutomaticDataCollectionEnabled(enabled);
        } catch {}
      },
      triggerEvent: async (eventId) => {
        try {
          await rnfInAppMessaging().triggerEvent(eventId);
        } catch (e) {
          if (__DEV__) console.warn("[InAppMessaging] triggerEvent error:", e);
        }
      },
    };
  } catch {
    if (__DEV__) {
      console.warn("[Firebase] In-App Messaging unavailable — using stub.");
    }
    _inAppMessaging = createInAppMessagingStub();
  }

  return _inAppMessaging;
}

export const inAppMessaging = getInAppMessaging();

// ─── Re-export config for debugging ──────────────────────────────────────────

export { firebaseConfig };
