import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

/**
 * Subscribe Tab - Redirects to Subscription Plans screen
 * 
 * This tab exists only to provide a bottom navigation entry point.
 * It immediately redirects to the actual Subscription Plans screen.
 */
export default function SubscribeTab() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to subscription-plans screen immediately
    router.replace("/subscription-plans" as any);
  }, []);

  return (
    <ScreenContainer className="items-center justify-center">
      <ActivityIndicator size="large" color="#0a7ea4" />
    </ScreenContainer>
  );
}
