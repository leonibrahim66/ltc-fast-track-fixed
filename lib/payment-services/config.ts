/**
 * Payment Configuration
 * 
 * This file manages payment provider API credentials.
 * 
 * IMPORTANT: Never commit real API keys to version control!
 * Use environment variables for production deployments.
 * 
 * How to configure:
 * 
 * 1. For Development (Sandbox):
 *    - Set PAYMENT_ENVIRONMENT=sandbox
 *    - Use test credentials from provider developer portals
 * 
 * 2. For Production:
 *    - Set PAYMENT_ENVIRONMENT=production
 *    - Set provider-specific environment variables
 * 
 * Environment Variables:
 * 
 * MTN MoMo:
 *   - MTN_MOMO_SUBSCRIPTION_KEY: Your Ocp-Apim-Subscription-Key
 *   - MTN_MOMO_USER_ID: API User ID
 *   - MTN_MOMO_API_KEY: API Key
 *   - MTN_MOMO_CALLBACK_URL: Webhook callback URL
 * 
 * Airtel Money:
 *   - AIRTEL_CLIENT_ID: OAuth Client ID
 *   - AIRTEL_CLIENT_SECRET: OAuth Client Secret
 *   - AIRTEL_CALLBACK_URL: Webhook callback URL
 */

import { MtnMomoConfig, AirtelMoneyConfig } from "./types";

// Environment detection
const getEnvironment = (): "sandbox" | "production" => {
  const env = process.env.PAYMENT_ENVIRONMENT || process.env.NODE_ENV;
  return env === "production" ? "production" : "sandbox";
};

// Get environment variable with fallback
const getEnvVar = (key: string, fallback = ""): string => {
  if (typeof process !== "undefined" && process.env) {
    return process.env[key] || fallback;
  }
  return fallback;
};

/**
 * MTN MoMo Configuration
 * 
 * To get credentials:
 * 1. Register at https://momodeveloper.mtn.com
 * 2. Subscribe to Collection API product
 * 3. Get your Primary Key (Subscription Key)
 * 4. Create API User and get API Key
 */
export const getMtnMomoConfig = (): Partial<MtnMomoConfig> => {
  const environment = getEnvironment();

  // Accept both naming conventions:
  //   Server-side:  MTN_API_KEY, MTN_COLLECTION_KEY, MTN_COLLECTION_SUBSCRIPTION_KEY, MTN_API_USER
  //   Frontend-side: MTN_MOMO_API_KEY, MTN_MOMO_SUBSCRIPTION_KEY, MTN_MOMO_USER_ID
  const subscriptionKey =
    getEnvVar("MTN_MOMO_SUBSCRIPTION_KEY") ||
    getEnvVar("MTN_COLLECTION_SUBSCRIPTION_KEY") ||
    getEnvVar("MTN_COLLECTION_KEY");

  const userId =
    getEnvVar("MTN_MOMO_USER_ID") ||
    getEnvVar("MTN_API_USER");

  const userApiKey =
    getEnvVar("MTN_MOMO_API_KEY") ||
    getEnvVar("MTN_API_KEY");

  const baseUrlFromEnv = getEnvVar("MTN_BASE_URL");

  return {
    provider: "mtn_momo",
    environment,
    subscriptionKey,
    userId,
    userApiKey,
    callbackUrl: getEnvVar("MTN_MOMO_CALLBACK_URL", "https://your-server.com/api/payments/mtn-callback"),
    targetEnvironment: environment === "production" ? "mtnzambia" : "sandbox",
    baseUrl: baseUrlFromEnv ||
      (environment === "production"
        ? "https://proxy.momoapi.mtn.com"
        : "https://sandbox.momodeveloper.mtn.com"),
    receiverNumber: "+260960819993",
  };
};

/**
 * Airtel Money Configuration
 * 
 * To get credentials:
 * 1. Contact Airtel Zambia Business team
 * 2. Register as a merchant
 * 3. Get Client ID and Client Secret
 */
export const getAirtelMoneyConfig = (): Partial<AirtelMoneyConfig> => {
  const environment = getEnvironment();
  
  return {
    provider: "airtel_money",
    environment,
    clientId: getEnvVar("AIRTEL_CLIENT_ID"),
    clientSecret: getEnvVar("AIRTEL_CLIENT_SECRET"),
    callbackUrl: getEnvVar("AIRTEL_CALLBACK_URL", "https://your-server.com/api/payments/airtel-callback"),
    grantType: "client_credentials",
    baseUrl: environment === "production"
      ? "https://openapi.airtel.africa"
      : "https://openapiuat.airtel.africa",
    receiverNumber: "20158560",
  };
};

/**
 * Check if a provider is configured
 */
export const isProviderConfigured = (provider: "mtn_momo" | "airtel_money"): boolean => {
  switch (provider) {
    case "mtn_momo": {
      const config = getMtnMomoConfig();
      return !!(config.subscriptionKey && config.userId && config.userApiKey);
    }
    case "airtel_money": {
      const config = getAirtelMoneyConfig();
      return !!(config.clientId && config.clientSecret);
    }
    default:
      return false;
  }
};

/**
 * Get all configured providers
 */
export const getConfiguredProviders = (): string[] => {
  const providers: string[] = [];
  
  if (isProviderConfigured("mtn_momo")) {
    providers.push("mtn_momo");
  }
  
  if (isProviderConfigured("airtel_money")) {
    providers.push("airtel_money");
  }
  
  return providers;
};

/**
 * Webhook URLs for payment callbacks
 * These should be configured in your payment provider dashboards
 */
export const WEBHOOK_URLS = {
  mtn_momo: "/api/payments/mtn-callback",
  airtel_money: "/api/payments/airtel-callback",
  generic: "/api/payments/callback",
} as const;

/**
 * Configuration validation
 */
export const validateConfig = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check MTN MoMo
  const mtnConfig = getMtnMomoConfig();
  if (!mtnConfig.subscriptionKey) {
    errors.push("MTN MoMo: Missing MTN_MOMO_SUBSCRIPTION_KEY");
  }
  if (!mtnConfig.userId) {
    errors.push("MTN MoMo: Missing MTN_MOMO_USER_ID");
  }
  if (!mtnConfig.userApiKey) {
    errors.push("MTN MoMo: Missing MTN_MOMO_API_KEY");
  }
  
  // Check Airtel Money
  const airtelConfig = getAirtelMoneyConfig();
  if (!airtelConfig.clientId) {
    errors.push("Airtel Money: Missing AIRTEL_CLIENT_ID");
  }
  if (!airtelConfig.clientSecret) {
    errors.push("Airtel Money: Missing AIRTEL_CLIENT_SECRET");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

// Export environment info
export const PAYMENT_CONFIG = {
  environment: getEnvironment(),
  currency: {
    code: "ZMW",
    symbol: "K",
    name: "Zambian Kwacha",
  },
  receivers: {
    mtn_momo: "+260960819993",
    airtel_money: "20158560",
  },
} as const;
