// Mock for expo-notifications in vitest
export const requestPermissionsAsync = async () => ({ status: "granted" });
export const getPermissionsAsync = async () => ({ status: "granted" });
export const getExpoPushTokenAsync = async () => ({ data: "ExponentPushToken[mock]" });
export const scheduleNotificationAsync = async () => "mock-notification-id";
export const cancelScheduledNotificationAsync = async () => {};
export const cancelAllScheduledNotificationsAsync = async () => {};
export const addNotificationReceivedListener = (_cb: unknown) => ({ remove: () => {} });
export const addNotificationResponseReceivedListener = (_cb: unknown) => ({ remove: () => {} });
export const setNotificationHandler = () => {};
export const AndroidImportance = { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 };
export default {
  requestPermissionsAsync, getPermissionsAsync, getExpoPushTokenAsync,
  scheduleNotificationAsync, cancelScheduledNotificationAsync, cancelAllScheduledNotificationsAsync,
  addNotificationReceivedListener, addNotificationResponseReceivedListener,
  setNotificationHandler, AndroidImportance,
};
