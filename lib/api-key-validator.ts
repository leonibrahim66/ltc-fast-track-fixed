/**
 * lib/api-key-validator.ts
 *
 * Startup API key validator for LTC Fast Track.
 *
 * Call `validateAllApiKeys()` once at app startup (in _layout.tsx) to get a
 * clear console report of which services are configured and which are missing
 * credentials. This never throws — it only logs.
 *
 * Services checked:
 *   - Supabase (database + auth)
 *   - Firebase (push notifications, analytics, crashlytics)
 *   - Google Maps (maps, routing, geocoding)
 *   - MTN Mobile Money (payments + disbursements)
 *   - Backend API (tRPC / Express server)
 */

export type ServiceStatus = {
  name: string;
  configured: boolean;
  missingKeys: string[];
  presentKeys: string[];
};

/**
 * Check a single env var — returns its trimmed value or empty string.
 */
function env(key: string): string {
  return process.env[key]?.trim() ?? "";
}

/**
 * Validate all API keys and return a structured status report.
 * Does NOT throw — safe to call at app startup.
 */
export function validateAllApiKeys(): ServiceStatus[] {
  const results: ServiceStatus[] = [];

  // ── Supabase ──────────────────────────────────────────────────────────────
  {
    const checks = [
      { key: "EXPO_PUBLIC_SUPABASE_URL", value: env("EXPO_PUBLIC_SUPABASE_URL") },
      { key: "EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY", value: env("EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY") },
    ];
    results.push({
      name: "Supabase",
      configured: checks.every((c) => c.value.length > 0),
      presentKeys: checks.filter((c) => c.value.length > 0).map((c) => c.key),
      missingKeys: checks.filter((c) => c.value.length === 0).map((c) => c.key),
    });
  }

  // ── Firebase ──────────────────────────────────────────────────────────────
  {
    const checks = [
      { key: "EXPO_PUBLIC_FIREBASE_API_KEY", value: env("EXPO_PUBLIC_FIREBASE_API_KEY") },
      { key: "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", value: env("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN") },
      { key: "EXPO_PUBLIC_FIREBASE_PROJECT_ID", value: env("EXPO_PUBLIC_FIREBASE_PROJECT_ID") },
      { key: "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", value: env("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET") },
      { key: "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", value: env("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") },
      { key: "EXPO_PUBLIC_FIREBASE_APP_ID", value: env("EXPO_PUBLIC_FIREBASE_APP_ID") },
    ];
    results.push({
      name: "Firebase",
      configured: checks.every((c) => c.value.length > 0),
      presentKeys: checks.filter((c) => c.value.length > 0).map((c) => c.key),
      missingKeys: checks.filter((c) => c.value.length === 0).map((c) => c.key),
    });
  }

  // ── Google Maps ───────────────────────────────────────────────────────────
  {
    const checks = [
      { key: "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY", value: env("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY") },
    ];
    results.push({
      name: "Google Maps",
      configured: checks.every((c) => c.value.length > 0),
      presentKeys: checks.filter((c) => c.value.length > 0).map((c) => c.key),
      missingKeys: checks.filter((c) => c.value.length === 0).map((c) => c.key),
    });
  }

  // ── MTN Mobile Money ──────────────────────────────────────────────────────
  // Accept both server-side and frontend naming conventions.
  {
    const collectionKey =
      env("MTN_COLLECTION_SUBSCRIPTION_KEY") ||
      env("MTN_COLLECTION_KEY") ||
      env("MTN_MOMO_SUBSCRIPTION_KEY");
    const disbursementKey =
      env("MTN_DISBURSEMENT_SUBSCRIPTION_KEY") ||
      env("MTN_DISBURSEMENT_KEY");
    const apiUser = env("MTN_API_USER") || env("MTN_MOMO_USER_ID");
    const apiKey = env("MTN_API_KEY") || env("MTN_MOMO_API_KEY");
    const baseUrl = env("MTN_BASE_URL");

    const missing: string[] = [];
    const present: string[] = [];

    if (baseUrl) present.push("MTN_BASE_URL"); else missing.push("MTN_BASE_URL");
    if (collectionKey) present.push("MTN_COLLECTION_KEY (or alias)"); else missing.push("MTN_COLLECTION_KEY / MTN_COLLECTION_SUBSCRIPTION_KEY / MTN_MOMO_SUBSCRIPTION_KEY");
    if (disbursementKey) present.push("MTN_DISBURSEMENT_KEY (or alias)"); else missing.push("MTN_DISBURSEMENT_KEY / MTN_DISBURSEMENT_SUBSCRIPTION_KEY");
    if (apiUser) present.push("MTN_API_USER (or alias)"); else missing.push("MTN_API_USER / MTN_MOMO_USER_ID");
    if (apiKey) present.push("MTN_API_KEY (or alias)"); else missing.push("MTN_API_KEY / MTN_MOMO_API_KEY");

    results.push({
      name: "MTN Mobile Money",
      configured: missing.length === 0,
      presentKeys: present,
      missingKeys: missing,
    });
  }

  // ── Backend API ───────────────────────────────────────────────────────────
  {
    const apiBaseUrl = env("EXPO_PUBLIC_API_BASE_URL");
    // Backend API base URL is optional — it can be derived from the hostname on web.
    results.push({
      name: "Backend API",
      configured: true, // always available (falls back to hostname derivation)
      presentKeys: apiBaseUrl ? ["EXPO_PUBLIC_API_BASE_URL"] : [],
      missingKeys: apiBaseUrl
        ? []
        : ["EXPO_PUBLIC_API_BASE_URL (optional — will auto-derive on web)"],
    });
  }

  return results;
}

/**
 * Print a formatted startup report to the console.
 * Call this once in the root layout after fonts load.
 */
export function logApiKeyReport(): void {
  const statuses = validateAllApiKeys();
  const allOk = statuses.every((s) => s.configured);

  const lines: string[] = [
    "",
    "╔══════════════════════════════════════════════════╗",
    "║        LTC Fast Track — API Key Status           ║",
    "╚══════════════════════════════════════════════════╝",
  ];

  for (const s of statuses) {
    const icon = s.configured ? "✅" : "❌";
    lines.push(`  ${icon}  ${s.name}`);
    if (s.missingKeys.length > 0) {
      for (const k of s.missingKeys) {
        lines.push(`       ⚠  Missing: ${k}`);
      }
    }
  }

  lines.push("");
  if (allOk) {
    lines.push("  All services configured. App is ready.");
  } else {
    lines.push("  Some services are missing keys.");
    lines.push("  Add them in Application Secrets → restart dev server.");
  }
  lines.push("");

  const report = lines.join("\n");
  if (allOk) {
    console.log(report);
  } else {
    console.warn(report);
  }
}
