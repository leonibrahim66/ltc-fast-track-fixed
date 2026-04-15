// Validate all required API keys are set and non-placeholder
const keys = {
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY,
};

let allOk = true;
for (const [k, v] of Object.entries(keys)) {
  const missing = !v || v.length === 0;
  const placeholder = v && (v.includes('placeholder') || v.includes('PLACEHOLDER') || v.includes('YOUR_'));
  const ok = !missing && !placeholder;
  const preview = ok ? v.substring(0, 25) + '...' : (v || 'MISSING');
  const icon = ok ? 'OK' : 'FAIL';
  console.log(`[${icon}] ${k}: ${preview}`);
  if (!ok) allOk = false;
}
console.log('');
console.log(allOk ? 'All keys validated successfully.' : 'WARNING: Some keys are missing or placeholder.');
process.exit(allOk ? 0 : 1);
