// Mock for expo-location in vitest
export const requestForegroundPermissionsAsync = async () => ({ status: "granted" });
export const requestBackgroundPermissionsAsync = async () => ({ status: "granted" });
export const getForegroundPermissionsAsync = async () => ({ status: "granted" });
export const getCurrentPositionAsync = async () => ({
  coords: { latitude: -15.4167, longitude: 28.2833, accuracy: 10, altitude: 0, heading: 0, speed: 0 },
  timestamp: Date.now(),
});
export const watchPositionAsync = async (_opts: unknown, callback: (loc: unknown) => void) => {
  callback({ coords: { latitude: -15.4167, longitude: 28.2833, accuracy: 10 }, timestamp: Date.now() });
  return { remove: () => {} };
};
export const Accuracy = {
  Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6,
};
export const PermissionStatus = {
  GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined",
};
export default { requestForegroundPermissionsAsync, getCurrentPositionAsync, watchPositionAsync, Accuracy, PermissionStatus };
