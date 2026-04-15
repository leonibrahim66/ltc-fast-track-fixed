// Runtime crash check - validates all keys that would cause module-load crashes
const checks = [
  {
    name: "Supabase URL",
    key: "EXPO_PUBLIC_SUPABASE_URL",
    validate: (v) => v && v.startsWith("https://") && v.includes("supabase.co"),
  },
  {
    name: "Supabase Anon Key",
    key: "EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY",
    validate: (v) => v && v.split(".").length === 3,
  },
  {
    name: "Firebase API Key",
    key: "EXPO_PUBLIC_FIREBASE_API_KEY",
    validate: (v) => v && v.startsWith("AIza"),
  },
  {
    name: "Firebase Project ID",
    key: "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    validate: (v) => v && v.length > 0,
  },
  {
    name: "Firebase App ID",
    key: "EXPO_PUBLIC_FIREBASE_APP_ID",
    validate: (v) => v && /^\d+:\d+:android:[a-f0-9]+$/.test(v),
  },
  {
    name: "Google Maps API Key",
    key: "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
    validate: (v) => v && v.startsWith("AIza"),
  },
];

let allPassed = true;
for (const check of checks) {
  const val = process.env[check.key] || "";
  const ok = check.validate(val);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${check.name} (${check.key})`);
  if (!ok) allPassed = false;
}

console.log("");
if (allPassed) {
  console.log("All runtime checks passed. No crash-prone missing keys detected.");
} else {
  console.log("WARNING: Some keys failed validation. App may crash at startup.");
  process.exit(1);
}
