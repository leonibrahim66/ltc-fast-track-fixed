/**
 * lib/supabase.ts
 *
 * Supabase client initialization for LTC Fast Track.
 *
 * Configuration is read exclusively from environment variables:
 *   EXPO_PUBLIC_SUPABASE_URL             — your Supabase project URL
 *   EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY — your Supabase anon/public key
 *
 * If either key is missing a clear error is logged and a placeholder client
 * is created against a dummy URL. All Supabase calls will fail with network
 * errors rather than crashing the app at startup.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY?.trim() ?? "";

// ─── Validate ─────────────────────────────────────────────────────────────────
export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

if (!isSupabaseConfigured()) {
  console.error(
    "[Supabase] ❌ Missing configuration — database features will not work.\n" +
      "  Required secrets:\n" +
      "    EXPO_PUBLIC_SUPABASE_URL\n" +
      "    EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY\n" +
      "  Add them in Application Secrets and restart the dev server."
  );
}

// ─── Client ───────────────────────────────────────────────────────────────────
// Always export a non-null client so callers don't need null-checks.
// If unconfigured, the client points to a placeholder URL and all calls will
// fail with a network error (not a crash), which is the correct behavior.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

export type SupabaseClient = typeof supabase;
