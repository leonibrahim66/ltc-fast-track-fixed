/**
 * Minimal mock for expo-constants in the Vitest node environment.
 */
export default {
  expoConfig: {
    name: "LTC Fast Track",
    slug: "ltc-fast-track",
    version: "1.0.0",
    extra: {},
  },
  manifest: null,
  manifest2: null,
  appOwnership: null,
  executionEnvironment: "storeClient",
  isDevice: false,
  sessionId: "test-session",
  statusBarHeight: 44,
  systemFonts: [],
  platform: { ios: {}, android: {} },
};

export const ExecutionEnvironment = {
  Bare: "bare",
  Standalone: "standalone",
  StoreClient: "storeClient",
};
