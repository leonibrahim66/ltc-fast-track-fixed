/**
 * Payment Service Types and Interfaces
 * Defines the structure for all payment integrations
 */

export type PaymentProvider = "mtn_momo" | "airtel_money" | "zamtel_money" | "bank_transfer" | "card";

export type PaymentStatus = 
  | "pending"      // Payment initiated, waiting for user action
  | "processing"   // Payment being processed by provider
  | "successful"   // Payment completed successfully
  | "failed"       // Payment failed
  | "cancelled"    // Payment cancelled by user
  | "expired"      // Payment request expired
  | "refunded";    // Payment was refunded

export type TransactionType = "collection" | "disbursement" | "refund";

export interface PaymentRequest {
  amount: number;
  currency: string;
  provider: PaymentProvider;
  phoneNumber: string;
  reference: string;
  description: string;
  metadata?: Record<string, string>;
  callbackUrl?: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  externalId?: string;
  status: PaymentStatus;
  message: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  phoneNumber: string;
  reference: string;
  timestamp: string;
  rawResponse?: unknown;
}

export interface PaymentStatusResponse {
  transactionId: string;
  externalId?: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  completedAt?: string;
  failureReason?: string;
}

export interface PaymentCallback {
  transactionId: string;
  externalId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  timestamp: string;
  signature?: string;
}

export interface PaymentProviderConfig {
  provider: PaymentProvider;
  apiKey: string;
  apiSecret?: string;
  subscriptionKey?: string;
  environment: "sandbox" | "production";
  baseUrl: string;
  callbackUrl: string;
  receiverNumber: string;
}

// MTN MoMo specific types
export interface MtnMomoConfig extends PaymentProviderConfig {
  provider: "mtn_momo";
  userId?: string;
  userApiKey?: string;
  targetEnvironment: "sandbox" | "mtnzambia";
}

// Airtel Money specific types
export interface AirtelMoneyConfig extends PaymentProviderConfig {
  provider: "airtel_money";
  clientId: string;
  clientSecret: string;
  grantType: "client_credentials";
}

// Payment service interface that all providers must implement
export interface IPaymentService {
  provider: PaymentProvider;
  
  // Initialize the service with configuration
  initialize(config: PaymentProviderConfig): Promise<void>;
  
  // Request a payment from customer
  requestPayment(request: PaymentRequest): Promise<PaymentResponse>;
  
  // Check payment status
  getPaymentStatus(transactionId: string): Promise<PaymentStatusResponse>;
  
  // Verify callback signature
  verifyCallback(callback: PaymentCallback): boolean;
  
  // Refund a payment (if supported)
  refundPayment?(transactionId: string, amount?: number): Promise<PaymentResponse>;
}

// Receiver numbers for the app
export const PAYMENT_RECEIVERS = {
  mtn_momo: "+260960819993",
  airtel_money: "20158560",
  zamtel_money: "", // To be added
} as const;

// Currency configuration
export const CURRENCY = {
  code: "ZMW",
  symbol: "K",
  name: "Zambian Kwacha",
} as const;
