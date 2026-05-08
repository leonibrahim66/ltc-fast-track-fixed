import { Platform } from "react-native";
import Constants from "expo-constants";
import { initializeApp, getApps, getApp } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

export function isFirebaseConfigured(): boolean {
  return (
    firebaseConfig.apiKey.length > 0 &&
    firebaseConfig.projectId.length > 0 &&
    firebaseConfig.appId.length > 0
  );
}

export function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

let _app: any = null;

export function getFirebaseApp(): any {
  if (!isFirebaseConfigured()) return null;

  try {
    _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return _app;
  } catch {
    return null;
  }
}

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

export type MessagingService = {
  isAvailable: boolean;
  getToken: () => Promise<string | null>;
  onMessage: (handler: (message: FirebaseMessage) => void) => () => void;
  onNotificationOpenedApp: (handler: (message: FirebaseMessage) => void) => () => void;
  getInitialNotification: () => Promise<FirebaseMessage | null>;
  setBackgroundMessageHandler: (handler: (message: FirebaseMessage) => Promise<void>) => void;
  requestPermission: () => Promise<boolean>;
};

function createMessagingStub(): MessagingService {
  return {
    isAvailable: false,
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

  if (Platform.OS === "web" || isExpoGo() || !isFirebaseConfigured()) {
    _messaging = createMessagingStub();
    return _messaging;
  }

  try {
    const pkg = require("@react-native-firebase/messaging");
    const rnfMessaging = pkg?.default;

    if (!rnfMessaging || typeof rnfMessaging !== "function") {
      _messaging = createMessagingStub();
      return _messaging;
    }

    const nativeInstance = rnfMessaging();

    if (!nativeInstance) {
      _messaging = createMessagingStub();
      return _messaging;
    }

    _messaging = {
      isAvailable: true,
      getToken: async () => {
        try {
          return await nativeInstance.getToken();
        } catch {
          return null;
        }
      },
      onMessage: (handler) => nativeInstance.onMessage(handler),
      onNotificationOpenedApp: (handler) => nativeInstance.onNotificationOpenedApp(handler),
      getInitialNotification: async () => nativeInstance.getInitialNotification(),
      setBackgroundMessageHandler: (handler) => nativeInstance.setBackgroundMessageHandler(handler),
      requestPermission: async () => {
        try {
          const authStatus = await nativeInstance.requestPermission();
          return !!authStatus;
        } catch {
          return false;
        }
      },
    };
  } catch {
    _messaging = createMessagingStub();
  }

  return _messaging;
}

export const messaging = getMessaging();

export function getAnalytics() {
  return { logEvent: async () => {} };
}

export function getCrashlytics() {
  return { recordError: () => {} };
}

export function getInAppMessaging() {
  return { triggerEvent: async () => {} };
}

export { firebaseConfig };