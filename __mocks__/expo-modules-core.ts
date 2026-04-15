/**
 * Minimal mock for expo-modules-core in the Vitest node environment.
 * Prevents "Cannot read properties of undefined (reading 'get')" errors
 * caused by native module initialization code that requires a native runtime.
 */

export const NativeModulesProxy = {};
export const EventEmitter = class {
  addListener() { return { remove: () => {} }; }
  removeAllListeners() {}
  emit() {}
};
export const Platform = {
  OS: "ios",
  select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
};
export const UnavailabilityError = class extends Error {
  constructor(moduleName: string, propertyName: string) {
    super(`${moduleName}.${propertyName} is not available`);
  }
};
export const requireOptionalNativeModule = () => null;
export const requireNativeModule = () => ({});
export const isRunningInExpoGo = () => false;

export default {
  NativeModulesProxy,
  EventEmitter,
  Platform,
  UnavailabilityError,
  requireOptionalNativeModule,
  requireNativeModule,
  isRunningInExpoGo,
};
