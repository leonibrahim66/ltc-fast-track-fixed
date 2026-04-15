import { describe, it, expect } from "vitest";

describe("Firebase & API Key Validation", () => {
  it("should have EXPO_PUBLIC_FIREBASE_API_KEY set and non-placeholder", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "";
    expect(val.length).toBeGreaterThan(0);
    expect(val).not.toContain("placeholder");
    expect(val).not.toContain("YOUR_");
  });

  it("should have EXPO_PUBLIC_FIREBASE_PROJECT_ID set", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "";
    expect(val.length).toBeGreaterThan(0);
    expect(val).not.toContain("placeholder");
  });

  it("should have EXPO_PUBLIC_FIREBASE_APP_ID set with correct format", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "";
    expect(val.length).toBeGreaterThan(0);
    // Android app ID format: 1:SENDER_ID:android:HEX
    expect(val).toMatch(/^\d+:\d+:android:[a-f0-9]+$/);
  });

  it("should have EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID set as numeric string", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "";
    expect(val.length).toBeGreaterThan(0);
    expect(val).toMatch(/^\d+$/);
  });

  it("should have EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN set", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";
    expect(val.length).toBeGreaterThan(0);
    expect(val).toContain(".firebaseapp.com");
  });

  it("should have EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET set", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";
    expect(val.length).toBeGreaterThan(0);
    expect(val).toContain("firebase");
  });

  it("should have EXPO_PUBLIC_GOOGLE_MAPS_API_KEY set and non-placeholder", () => {
    const val = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    expect(val.length).toBeGreaterThan(0);
    expect(val).not.toContain("placeholder");
    expect(val).toMatch(/^AIza/);
  });

  it("should have EXPO_PUBLIC_SUPABASE_URL set with correct format", () => {
    const val = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
    expect(val.length).toBeGreaterThan(0);
    expect(val).toMatch(/^https:\/\/.+\.supabase\.co$/);
  });

  it("should have EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY set as JWT", () => {
    const val = process.env.EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY ?? "";
    expect(val.length).toBeGreaterThan(0);
    // JWT format: three base64 segments separated by dots
    expect(val.split(".").length).toBe(3);
  });

  it("should have all 6 Firebase keys consistent (project_id matches auth_domain)", () => {
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "";
    const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";
    const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";
    expect(authDomain).toContain(projectId);
    expect(storageBucket).toContain(projectId);
  });
});
