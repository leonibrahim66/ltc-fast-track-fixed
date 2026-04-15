/**
 * useAppStateRefresh
 *
 * Calls `onRefresh` whenever the app returns to the foreground (active state).
 * This is the primary cross-device sync mechanism: when a user on another
 * device makes a change, this device will pick it up the next time it becomes
 * active.
 *
 * Usage:
 *   useAppStateRefresh(loadData);
 */
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

export function useAppStateRefresh(onRefresh: () => void): void {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const callbackRef = useRef(onRefresh);

  // Keep the callback ref up to date without re-subscribing
  useEffect(() => {
    callbackRef.current = onRefresh;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        callbackRef.current();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);
}
