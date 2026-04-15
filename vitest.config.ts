import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Allow importing .tsx files in tests
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx", "**/tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "android", "ios"],
  },
  define: {
    // React Native / Expo globals required in node test environment
    __DEV__: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Mock React Native modules that can't run in Node
      "react-native": path.resolve(__dirname, "__mocks__/react-native.ts"),
      "react-native-maps": path.resolve(__dirname, "__mocks__/react-native-maps.ts"),
      "expo-location": path.resolve(__dirname, "__mocks__/expo-location.ts"),
      "expo-haptics": path.resolve(__dirname, "__mocks__/expo-haptics.ts"),
      "expo-notifications": path.resolve(__dirname, "__mocks__/expo-notifications.ts"),
      // Mock expo-modules-core to avoid native module errors in tests
      "expo-modules-core": path.resolve(__dirname, "__mocks__/expo-modules-core.ts"),
      "expo-constants": path.resolve(__dirname, "__mocks__/expo-constants.ts"),
      "expo-linking": path.resolve(__dirname, "__mocks__/expo-linking.ts"),
    },
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  esbuild: {
    jsx: "automatic" as const,
  },
});
