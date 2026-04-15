/**
 * collector-households.tsx
 * Redirect shim — tasks.tsx links to /collector-households,
 * which maps to the (collector)/households tab screen.
 */
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function CollectorHouseholdsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(collector)/households" as any);
  }, []);

  return null;
}
