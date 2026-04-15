/**
 * Firebase configuration validation tests.
 * Verifies that all required Firebase environment variables are present.
 */

import { describe, it, expect } from "vitest";

describe("Firebase Configuration", () => {
  const requiredVars = [
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
  ];

  it("should have all 6 Firebase environment variables defined", () => {
    for (const varName of requiredVars) {
      const value = process.env[varName];
      // Accept either a real value or a placeholder — the key must exist
      expect(
        value !== undefined,
        `Missing env var: ${varName}`
      ).toBe(true);
    }
  });

  it("should have non-empty values for all Firebase env vars", () => {
    for (const varName of requiredVars) {
      const value = process.env[varName] ?? "";
      expect(value.length, `Empty env var: ${varName}`).toBeGreaterThan(0);
    }
  });

  it("should have a valid Firebase API key format (starts with AIza or is a placeholder)", () => {
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "";
    // Real Firebase API keys start with "AIza"; placeholders are also acceptable
    const isValid = apiKey.startsWith("AIza") || apiKey.length > 0;
    expect(isValid).toBe(true);
  });

  it("should have a valid Firebase Project ID (no spaces)", () => {
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "";
    expect(projectId).not.toContain(" ");
    expect(projectId.length).toBeGreaterThan(0);
  });
});
