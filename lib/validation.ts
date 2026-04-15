/**
 * Phone number validation and formatting utilities
 * Standardizes all phone numbers to format: 260XXXXXXXXX (Zambian format)
 */

/**
 * Format phone number to standard Zambian format: 260XXXXXXXXX
 * Handles various input formats:
 * - +260971234567
 * - 0971234567
 * - 260971234567
 * - 971234567
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return "";

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, "");

  // If it doesn't start with 260, add it
  if (!cleaned.startsWith("260")) {
    cleaned = "260" + cleaned;
  }

  // Ensure it's exactly 12 digits (260 + 9 digits)
  if (cleaned.length !== 12) {
    return "";
  }

  return cleaned;
}

/**
 * Format phone number for display: +260971234567
 */
export function formatPhoneForDisplay(phone: string): string {
  const formatted = formatPhoneNumber(phone);
  if (!formatted) return "";
  return "+" + formatted;
}

/**
 * Validate phone number
 * Returns true if valid Zambian phone number
 */
export function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  return formatted.length === 12 && formatted.startsWith("260");
}

/**
 * Get phone number without country code: 971234567
 */
export function getPhoneWithoutCountryCode(phone: string): string {
  const formatted = formatPhoneNumber(phone);
  if (!formatted) return "";
  return formatted.slice(3); // Remove "260"
}

/**
 * Validate amount
 * Returns true if valid positive number
 */
export function isValidAmount(amount: string | number): boolean {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0;
}

/**
 * Validate PIN
 * Returns true if 4-digit PIN
 */
export function isValidPIN(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
