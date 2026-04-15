/**
 * Base Payment Service
 * Abstract class that all payment providers extend
 */

import {
  PaymentProvider,
  PaymentProviderConfig,
  PaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
  PaymentCallback,
  PaymentStatus,
  IPaymentService,
} from "./types";

export abstract class BasePaymentService implements IPaymentService {
  abstract provider: PaymentProvider;
  protected config: PaymentProviderConfig | null = null;
  protected isInitialized = false;

  abstract initialize(config: PaymentProviderConfig): Promise<void>;
  abstract requestPayment(request: PaymentRequest): Promise<PaymentResponse>;
  abstract getPaymentStatus(transactionId: string): Promise<PaymentStatusResponse>;
  abstract verifyCallback(callback: PaymentCallback): boolean;

  /**
   * Generate a unique transaction reference
   */
  protected generateReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `LTC${timestamp}${random}`;
  }

  /**
   * Generate a unique transaction ID
   */
  protected generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Format phone number for the provider
   */
  protected formatPhoneNumber(phone: string, countryCode = "260"): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, "");
    
    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, "");
    
    // Add country code if not present
    if (!cleaned.startsWith(countryCode)) {
      cleaned = countryCode + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Validate phone number format
   */
  protected isValidPhoneNumber(phone: string): boolean {
    const cleaned = this.formatPhoneNumber(phone);
    // Zambian numbers: 260 + 9 digits
    return /^260\d{9}$/.test(cleaned);
  }

  /**
   * Create error response
   */
  protected createErrorResponse(
    message: string,
    request: PaymentRequest
  ): PaymentResponse {
    return {
      success: false,
      transactionId: this.generateTransactionId(),
      status: "failed" as PaymentStatus,
      message,
      provider: request.provider,
      amount: request.amount,
      currency: request.currency,
      phoneNumber: request.phoneNumber,
      reference: request.reference,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create success response
   */
  protected createSuccessResponse(
    transactionId: string,
    externalId: string,
    request: PaymentRequest,
    status: PaymentStatus = "pending"
  ): PaymentResponse {
    return {
      success: true,
      transactionId,
      externalId,
      status,
      message: "Payment request initiated successfully",
      provider: request.provider,
      amount: request.amount,
      currency: request.currency,
      phoneNumber: request.phoneNumber,
      reference: request.reference,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log payment activity (for debugging)
   */
  protected log(action: string, data: unknown): void {
    if (__DEV__) {
      console.log(`[${this.provider}] ${action}:`, data);
    }
  }

  /**
   * Check if service is initialized
   */
  protected ensureInitialized(): void {
    if (!this.isInitialized || !this.config) {
      throw new Error(`${this.provider} service not initialized. Call initialize() first.`);
    }
  }
}

// Development mode flag
declare const __DEV__: boolean;
