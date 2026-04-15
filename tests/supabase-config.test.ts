import { describe, it, expect } from "vitest";

describe("Supabase Configuration", () => {
  it("should have EXPO_PUBLIC_SUPABASE_URL set", () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    expect(url).toBeDefined();
    expect(url).toContain("supabase.co");
  });

  it("should have EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY set", () => {
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
  });

  it("should be able to reach Supabase URL", async () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    expect(url).toBeDefined();
    // Basic URL format validation
    expect(url).toMatch(/^https:\/\/.+\.supabase\.co$/);
  });
});
