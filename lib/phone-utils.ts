/**
 * Phone number utilities for LTC Fast Track.
 * Handles validation, normalization, and PawaPay network detection
 * for Zambia (ZMB) and Tanzania (TZA).
 */

// ─── Zambia ───────────────────────────────────────────────────────────────────

/** Zambia valid prefixes (local format, 0XX) */
const ZMB_PREFIXES = ["096", "076", "097", "077", "095", "075"];

/**
 * Validate a Zambian phone number.
 * Accepts: 09XXXXXXXX (10 digits), 07XXXXXXXX (10 digits),
 *          2609XXXXXXXX (12 digits), +2609XXXXXXXX (13 chars).
 */
export function validateZambiaPhone(raw: string): boolean {
  const phone = raw.replace(/\s+/g, "").replace(/^\+/, "");
  let local = phone;
  if (local.startsWith("260")) local = "0" + local.slice(3);
  if (!local.startsWith("0")) local = "0" + local;
  if (local.length !== 10) return false;
  const prefix = local.substring(0, 3);
  return ZMB_PREFIXES.includes(prefix);
}

/**
 * Normalise a Zambian phone number to E.164 without the + sign.
 * e.g. 0971234567 → 260971234567
 */
export function normalizeZambiaPhone(raw: string): string {
  const phone = raw.replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("260")) return phone;
  if (phone.startsWith("0")) return "260" + phone.slice(1);
  return "260" + phone;
}

/**
 * Detect the Zambian MNO from a phone number.
 * Returns a PawaPay correspondent ID.
 */
export function detectZambiaNetwork(rawPhone: string): string {
  let phone = rawPhone.replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("260")) phone = "0" + phone.slice(3);
  if (!phone.startsWith("0")) phone = "0" + phone;

  const prefix3 = phone.substring(0, 3);
  // MTN: 096, 076
  if (prefix3 === "096" || prefix3 === "076") return "MTN_MOMO_ZMB";
  // Airtel: 097, 077
  if (prefix3 === "097" || prefix3 === "077") return "AIRTEL_OAPI_ZMB";
  // Zamtel: 095, 075
  if (prefix3 === "095" || prefix3 === "075") return "ZAMTEL_ZMB";

  // Fallback 2-digit prefix (legacy short numbers)
  const prefix2 = phone.substring(1, 3);
  if (prefix2 === "96" || prefix2 === "76") return "MTN_MOMO_ZMB";
  if (prefix2 === "97" || prefix2 === "77") return "AIRTEL_OAPI_ZMB";
  if (prefix2 === "95" || prefix2 === "75") return "ZAMTEL_ZMB";

  return "MTN_MOMO_ZMB"; // default
}

// ─── Tanzania ─────────────────────────────────────────────────────────────────

/** Tanzania valid prefixes (local format, 0XX) */
const TZA_PREFIXES = [
  "074", "075", "076", // Vodacom
  "078",               // Airtel
  "071", "065",        // Tigo
  "062",               // Halotel
];

/**
 * Validate a Tanzanian phone number.
 * Accepts: 07XXXXXXXX (10 digits), 06XXXXXXXX (10 digits),
 *          25507XXXXXXXX (12 digits), +25507XXXXXXXX (13 chars).
 */
export function validateTanzaniaPhone(raw: string): boolean {
  const phone = raw.replace(/\s+/g, "").replace(/^\+/, "");
  let local = phone;
  if (local.startsWith("255")) local = "0" + local.slice(3);
  if (!local.startsWith("0")) local = "0" + local;
  if (local.length !== 10) return false;
  const prefix = local.substring(0, 3);
  return TZA_PREFIXES.includes(prefix);
}

/**
 * Normalise a Tanzanian phone number to E.164 without the + sign.
 * e.g. 0741234567 → 255741234567
 */
export function normalizeTanzaniaPhone(raw: string): string {
  const phone = raw.replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("255")) return phone;
  if (phone.startsWith("0")) return "255" + phone.slice(1);
  return "255" + phone;
}

/**
 * Detect the Tanzanian MNO from a phone number.
 * Returns a PawaPay correspondent ID.
 */
export function detectTanzaniaNetwork(rawPhone: string): string {
  let phone = rawPhone.replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("255")) phone = "0" + phone.slice(3);
  if (!phone.startsWith("0")) phone = "0" + phone;

  const prefix3 = phone.substring(0, 3);
  // Vodacom: 074, 075, 076
  if (prefix3 === "074" || prefix3 === "075" || prefix3 === "076") return "VODACOM_TZA";
  // Airtel: 078
  if (prefix3 === "078") return "AIRTEL_OAPI_TZA";
  // Tigo: 071, 065
  if (prefix3 === "071" || prefix3 === "065") return "TIGO_TZA";
  // Halotel: 062
  if (prefix3 === "062") return "HALOTEL_TZA";

  return "VODACOM_TZA"; // default
}

// ─── Unified API ──────────────────────────────────────────────────────────────

/**
 * Validate a phone number for a given country code.
 */
export function validatePhone(countryCode: string, raw: string): boolean {
  if (countryCode === "ZMB") return validateZambiaPhone(raw);
  if (countryCode === "TZA") return validateTanzaniaPhone(raw);
  return false;
}

/**
 * Normalise a phone number to E.164 (no + prefix) for a given country code.
 */
export function normalizePhone(countryCode: string, raw: string): string {
  if (countryCode === "ZMB") return normalizeZambiaPhone(raw);
  if (countryCode === "TZA") return normalizeTanzaniaPhone(raw);
  return raw.replace(/\s+/g, "").replace(/^\+/, "");
}

/**
 * Detect the MNO (PawaPay correspondent ID) for a given country + phone.
 */
export function detectNetwork(countryCode: string, rawPhone: string): string {
  if (countryCode === "ZMB") return detectZambiaNetwork(rawPhone);
  if (countryCode === "TZA") return detectTanzaniaNetwork(rawPhone);
  return "MTN_MOMO_ZMB";
}

/**
 * Strip the country dial code prefix from a phone number to get the local part.
 * Used to pre-populate the phone input field.
 * e.g. "260971234567" → "971234567" (for Zambia)
 *      "255741234567" → "741234567" (for Tanzania)
 */
export function stripDialCode(countryCode: string, e164: string): string {
  const phone = e164.replace(/^\+/, "");
  if (countryCode === "ZMB" && phone.startsWith("260")) return phone.slice(3);
  if (countryCode === "TZA" && phone.startsWith("255")) return phone.slice(3);
  if (phone.startsWith("0")) return phone.slice(1);
  return phone;
}

/**
 * Return a human-readable phone error message for a given country.
 */
export function phoneErrorMessage(countryCode: string): string {
  if (countryCode === "ZMB") {
    return "Enter a valid Zambian number (e.g. 0971234567). Supported: MTN (096/076), Airtel (097/077), Zamtel (095/075).";
  }
  if (countryCode === "TZA") {
    return "Enter a valid Tanzanian number (e.g. 0741234567). Supported: Vodacom (074/075/076), Airtel (078), Tigo (071/065), Halotel (062).";
  }
  return "Enter a valid phone number.";
}
