import 'react-native-url-polyfill/auto';
import "react-native-reanimated";
import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "@/hooks/use-fonts";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { PickupsProvider } from "@/lib/pickups-context";
import { RecyclerProvider } from "@/lib/recycler-context";
import { PaymentsProvider } from "@/lib/payments-context";
import { WalletProvider } from "@/lib/wallet-context";
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
import { APICostCalculatorProvider } from "@/lib/api-cost-calculator-context";
import {
  SubscriptionApprovalProvider,
  ActivateSubscriptionCallback,
} from "@/lib/subscription-approval-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StorageEventBus } from "@/lib/storage-event-bus";
import { BookingNotificationProvider } from "@/lib/booking-notification-context";
import { NewsProvider } from "@/contexts/news-context";
import { InviteCodesProvider } from "@/lib/invite-codes-context";
import { TonnageProvider } from "@/lib/tonnage-context";
import { GlobalNotificationProvider } from "@/lib/global-notification-context";
import { InAppNotificationBanner } from "@/components/in-app-notification-banner";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { initCrashlytics } from "@/lib/firebase-crashlytics";
import { initFCMListeners, registerFCMToken } from "@/lib/firebase-notifications";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { logApiKeyReport } from "@/lib/api-key-validator";
import Constants from "expo-constants";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: "(auth)",
};

function SubscriptionApprovalBridge({ children }: { children: React.ReactNode }) {
  const handleActivate: ActivateSubscriptionCallback = async (userId, subscription) => {
    try {
      const usersDbRaw = await AsyncStorage.getItem("@ltc_users_db");
      if (usersDbRaw) {
        const usersDb = JSON.parse(usersDbRaw);
        if (usersDb[userId]) {
          usersDb[userId] = { ...usersDb[userId], subscription };
          await AsyncStorage.setItem("@ltc_users_db", JSON.stringify(usersDb));
          StorageEventBus.emit("@ltc_users_db");
        }
      }

      const sessionRaw = await AsyncStorage.getItem("@ltc_user");
      if (sessionRaw) {
        const sessionUser = JSON.parse(sessionRaw);
        if (sessionUser.id === userId) {
          const updatedSession = { ...sessionUser, subscription };
          await AsyncStorage.setItem("@ltc_user", JSON.stringify(updatedSession));
          StorageEventBus.emit("@ltc_user");
        }
      }
    } catch (err) {
      console.warn("[SubscriptionApprovalBridge] Failed to activate subscription:", err);
    }
  };

  return (
    <SubscriptionApprovalProvider onActivateSubscription={handleActivate}>
      {children}
    </SubscriptionApprovalProvider>
  );
}

function FCMBootLoader() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const isExpoGo = Constants.appOwnership === "expo";

    if (Platform.OS !== "web" && !isExpoGo) {
      registerFCMToken().catch(() => {});
      cleanup = initFCMListeners();
    } else {
      console.log("[RootLayout] FCM disabled in Expo Go");
    }

    return () => cleanup?.();
  }, []);

  return null;
}

 function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
     <FCMBootLoader/>
      <PickupsProvider>
        <RecyclerProvider>
          <PaymentsProvider>
            <WalletProvider>
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
                                                                                  {children}
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
            </WalletProvider>
          </PaymentsProvider>
        </RecyclerProvider>
      </PickupsProvider>
    </AuthProvider>
  );
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // fonts now load independently — no auth dependency
  const { fontsLoaded } = useFonts();

  // stage heavy providers one frame after splash hides

 const splashHidden = useRef(false);

useEffect(() => {
  if (fontsLoaded && !splashHidden.current) {
    splashHidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }
}, [fontsLoaded]);

  useEffect(() => {
    if (__DEV__) {
      logApiKeyReport();
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("@ltc_gmaps_api_key")
      .then((existing) => {
        if (!existing) {
          AsyncStorage.setItem(
            "@ltc_gmaps_api_key",
            "AIzaSyBEOn1Y96vn6HQ2xWqZzPGsHLrII1Mdk8k"
          ).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    initManusRuntime();
  }, []);

  useEffect(() => {
    initCrashlytics();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

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

  if (!fontsLoaded) {
    return null;
  }

 const content = (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="oauth/callback" />
        </Stack>
        <StatusBar style="auto" />
      </AppProviders>
    </QueryClientProvider>
  </GestureHandlerRootView>
);

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
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        {content}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}