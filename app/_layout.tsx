import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "@/hooks/use-fonts";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { PickupsProvider } from "@/lib/pickups-context";
import { RecyclerProvider } from "@/lib/recycler-context";
import { PaymentsProvider } from "@/lib/payments-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { RemindersProvider } from "@/lib/reminders-context";
import { I18nProvider } from "@/lib/i18n-context";
import { ReferralsProvider } from "@/lib/referrals-context";
import { ServiceZonesProvider } from "@/lib/service-zones-context";
import { WithdrawalsProvider } from "@/lib/withdrawals-context";
import { DisputesProvider } from "@/lib/disputes-context";
import { FeaturedUpdatesProvider } from "@/lib/featured-updates-context";
import { AdminProvider } from "@/lib/admin-context";
import { AlertsProvider } from "@/lib/alerts-context";
import { NotificationSettingsProvider } from "@/lib/notification-settings-context";
import { ActivityLogsProvider } from "@/lib/activity-logs-context";
import { ScheduledReportsProvider } from "@/lib/scheduled-reports-context";
import { DeviceSessionsProvider } from "@/lib/device-sessions-context";
import { BiometricProvider } from "@/lib/biometric-context";
import { ITRealtimeProvider } from "@/lib/it-realtime-context";
import { AlertSoundsProvider } from "@/lib/alert-sounds-context";
import { GeofencingProvider } from "@/lib/geofencing-context";
import { ChatProvider } from "@/lib/chat-context";
import { ContentManagementProvider } from "@/lib/content-management-context";
import { APIKeysProvider } from "@/lib/api-keys-context";
import { WebhooksProvider } from "@/lib/webhooks-context";
import { RateLimitProvider } from "@/lib/rate-limiting-context";
import { APIMonitoringProvider } from "@/lib/api-monitoring-context";
import { SandboxProvider } from "@/lib/sandbox-context";
import { RateLimitAlertsProvider } from "@/lib/rate-limit-alerts-context";
import { WebhookRetryProvider } from "@/lib/webhook-retry-context";
import { APICostCalculatorProvider } from '@/lib/api-cost-calculator-context';
import { SubscriptionApprovalProvider, ActivateSubscriptionCallback } from '@/lib/subscription-approval-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageEventBus } from '@/lib/storage-event-bus';
import { BookingNotificationProvider } from '@/lib/booking-notification-context';
import { NewsProvider } from '@/contexts/news-context';
import { InviteCodesProvider } from '@/lib/invite-codes-context';
import { TonnageProvider } from '@/lib/tonnage-context';
import { GlobalNotificationProvider } from '@/lib/global-notification-context';
import { InAppNotificationBanner } from '@/components/in-app-notification-banner';
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initCrashlytics } from "@/lib/firebase-crashlytics";
import { initFCMListeners, registerFCMToken } from "@/lib/firebase-notifications";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { useJobNotifications } from "@/hooks/use-job-notifications";
import { logApiKeyReport } from "@/lib/api-key-validator";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

// Keep splash screen visible while fonts load.
// useFonts hook calls SplashScreen.hideAsync() once fonts are ready or timed out.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Safe to ignore: throws if splash screen is already hidden
});

export const unstable_settings = {
  anchor: "(auth)",
};

/**
 * Bridge component: lives inside AuthProvider so it can call useAuth(),
 * then passes a subscription-activation callback into SubscriptionApprovalProvider.
 *
 * FIX: The original implementation called updateUser() which always patches the
 * CURRENTLY logged-in user (the admin). Instead, we now write the subscription
 * directly to the target customer's record in @ltc_users_db by userId, and also
 * update @ltc_user if that customer happens to be the active session — then emit
 * the StorageEventBus so the Home screen reloads immediately.
 */
function SubscriptionApprovalBridge({ children }: { children: React.ReactNode }) {
  const { user: currentUser } = useAuth();

  const handleActivate: ActivateSubscriptionCallback = async (userId, subscription) => {
    try {
      // 1. Write subscription to the customer's record in the users database
      const usersDbRaw = await AsyncStorage.getItem('@ltc_users_db');
      if (usersDbRaw) {
        const usersDb = JSON.parse(usersDbRaw);
        if (usersDb[userId]) {
          usersDb[userId] = { ...usersDb[userId], subscription };
          await AsyncStorage.setItem('@ltc_users_db', JSON.stringify(usersDb));
          StorageEventBus.emit('@ltc_users_db');
        }
      }

      // 2. If the customer is the currently logged-in session, also update @ltc_user
      //    so the Home screen sees the change immediately without requiring re-login.
      const sessionRaw = await AsyncStorage.getItem('@ltc_user');
      if (sessionRaw) {
        const sessionUser = JSON.parse(sessionRaw);
        if (sessionUser.id === userId) {
          const updatedSession = { ...sessionUser, subscription };
          await AsyncStorage.setItem('@ltc_user', JSON.stringify(updatedSession));
          StorageEventBus.emit('@ltc_user');
        }
      }
    } catch (err) {
      console.warn('[SubscriptionApprovalBridge] Failed to activate subscription:', err);
    }
  };

  return (
    <SubscriptionApprovalProvider onActivateSubscription={handleActivate}>
      {children}
    </SubscriptionApprovalProvider>
  );
}

/**
 * Inner component that lives inside AuthProvider so it can read isLoading.
 * Once auth has resolved (isLoading = false), it signals the fonts hook to
 * hide the splash screen — preventing the brief welcome screen flash on reopen.
 */
function AuthGate({ onAuthReady }: { onAuthReady: (ready: boolean) => void }) {
  const { isLoading, user } = useAuth();
  useEffect(() => {
    if (!isLoading) {
      onAuthReady(true);
    }
  }, [isLoading, onAuthReady]);
  return null;
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Gate: becomes true once auth context has finished loading from AsyncStorage
  const [authReady, setAuthReady] = useState(false);
  const handleAuthReady = useCallback(() => setAuthReady(true), []);

  // Load fonts with a 5s timeout fallback to system fonts.
  // Pass authReady as the external gate so splash is only hidden once BOTH
  // fonts are resolved AND the auth session has been read from AsyncStorage.
  // This prevents the brief welcome screen flash when reopening the app.
  const { fontsLoaded } = useFonts(authReady);
  // SPLASH SCREEN LAST-RESORT FALLBACK
  // If all other mechanisms fail (fonts hook, auth gate, etc.), this ensures
  // the splash screen is ALWAYS hidden within 3 seconds of RootLayout mounting.
  // This is the final safety net for APK installs where native modules may be
  // slow to initialize.
  useEffect(() => {
    const emergencyTimer = setTimeout(() => {
      if (__DEV__) {
        console.warn('[RootLayout] Emergency splash hide triggered after 3s timeout');
      }
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    return () => clearTimeout(emergencyTimer);
  }, []);

  // Log API key status once at startup so developers can see which services are configured
  useEffect(() => {
    if (__DEV__) {
      logApiKeyReport();
    }
  }, []);

  // Seed Google Maps API key into AsyncStorage on first launch (or if not yet set).
  // The key is read by fetchPlaceCoordinates in lib/zone-google-maps.ts.
  useEffect(() => {
    AsyncStorage.getItem('@ltc_gmaps_api_key').then((existing) => {
      if (!existing) {
        AsyncStorage.setItem('@ltc_gmaps_api_key', 'AIzaSyBEOn1Y96vn6HQ2xWqZzPGsHLrII1Mdk8k').catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  // Initialize Firebase Crashlytics global error handler
  useEffect(() => {
    initCrashlytics();
  }, []);

  // Register FCM token and start notification listeners
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (Platform.OS !== "web") {
      registerFCMToken().catch(() => {});
      cleanup = initFCMListeners();
    }
    return () => cleanup?.();
  }, []);
  // Register device for Expo push notifications (native device-level alerts)
  // This handles permission request, token registration, and deep-link navigation on tap
  useJobNotifications({ registerOnMount: true });

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* AuthGate reads isLoading from AuthProvider and signals RootLayout
                once the session has been loaded from AsyncStorage, so the splash
                screen stays visible until auth is resolved. */}
            <AuthGate onAuthReady={handleAuthReady} />
            <PickupsProvider>
              <RecyclerProvider>
                <PaymentsProvider>
                  <NotificationsProvider>
                    <RemindersProvider>
                      <I18nProvider>
                        <ReferralsProvider>
                          <ServiceZonesProvider>
                            <WithdrawalsProvider>
                              <DisputesProvider>
                                <FeaturedUpdatesProvider>
                                  <AdminProvider>
                                    <AlertsProvider>
                                      <NotificationSettingsProvider>
                                        <ActivityLogsProvider>
                                          <ScheduledReportsProvider>
                                            <DeviceSessionsProvider>
                                              <BiometricProvider>
                                                <ITRealtimeProvider>
                                                  <AlertSoundsProvider>
                                                    <GeofencingProvider>
                                                      <ChatProvider>
                                                        <ContentManagementProvider>
                                                          <APIKeysProvider>
                                                            <WebhooksProvider>
                                                              <RateLimitProvider>
                                                                <APIMonitoringProvider>
                                                                  <SandboxProvider>
                                                                    <RateLimitAlertsProvider>
                                                                      <WebhookRetryProvider>
                                                                        <APICostCalculatorProvider>
                                                                          <SubscriptionApprovalBridge>
                                                                            <BookingNotificationProvider>
                                                                              <NewsProvider>
                                                                                <InviteCodesProvider>
                                                                                <TonnageProvider>
                                                                                <GlobalNotificationProvider>
                                                                                <InAppNotificationBanner />
                                                                                <Stack screenOptions={{ headerShown: false }} initialRouteName="(auth)">
                                                                                <Stack.Screen name="(auth)" />
                                                                                <Stack.Screen name="(tabs)" />
                                                                                <Stack.Screen name="oauth/callback" />
                                                                                </Stack>
                                                                                <StatusBar style="auto" />
                                                                                </GlobalNotificationProvider>
                                                                                </TonnageProvider>
                                                                                </InviteCodesProvider>
                                                                              </NewsProvider>
                                                                            </BookingNotificationProvider>
                                                                          </SubscriptionApprovalBridge>
                                                                        </APICostCalculatorProvider>
                                                                      </WebhookRetryProvider>
                                                                    </RateLimitAlertsProvider>
                                                                  </SandboxProvider>
                                                                </APIMonitoringProvider>
                                                              </RateLimitProvider>
                                                            </WebhooksProvider>
                                                          </APIKeysProvider>
                                                        </ContentManagementProvider>
                                                      </ChatProvider>
                                                    </GeofencingProvider>
                                                  </AlertSoundsProvider>
                                                </ITRealtimeProvider>
                                              </BiometricProvider>
                                            </DeviceSessionsProvider>
                                          </ScheduledReportsProvider>
                                        </ActivityLogsProvider>
                                      </NotificationSettingsProvider>
                                    </AlertsProvider>
                                  </AdminProvider>
                                </FeaturedUpdatesProvider>
                              </DisputesProvider>
                            </WithdrawalsProvider>
                          </ServiceZonesProvider>
                        </ReferralsProvider>
                      </I18nProvider>
                    </RemindersProvider>
                  </NotificationsProvider>
                </PaymentsProvider>
              </RecyclerProvider>
            </PickupsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  // Do not render until fonts are resolved (or timed out) to prevent
  // a flash of unstyled text on the first render.
  // NOTE: This early return is placed AFTER all hooks to comply with Rules of Hooks.
  // IMPORTANT: The emergency 3-second timer above ensures fontsLoaded becomes true
  // within 3 seconds even if auth/AsyncStorage never resolves, so this null return
  // will never block the app indefinitely on a fresh APK install.
  if (!fontsLoaded) {
    return null;
  }

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
