/**
 * MTN Mobile Money (MoMo) Payment Service
 * Integration with MTN MoMo API for Zambia
 * 
 * API Documentation: https://momodeveloper.mtn.com/docs
 * 
 * To get API credentials:
 * 1. Register at https://momodeveloper.mtn.com
 * 2. Subscribe to Collection API product
 * 3. Get your Primary Key (Subscription Key)
 * 4. Create API User and get API Key
 */

import { BasePaymentService } from "./base-service";
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
  PaymentCallback,
  MtnMomoConfig,
  PAYMENT_RECEIVERS,
} from "./types";

export class MtnMomoService extends BasePaymentService {
  provider: PaymentProvider = "mtn_momo";
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private momoConfig: MtnMomoConfig | null = null;

  // MTN MoMo API endpoints
  private readonly SANDBOX_URL = "https://sandbox.momodeveloper.mtn.com";
  private readonly PRODUCTION_URL = "https://proxy.momoapi.mtn.com"; // Zambia production

  async initialize(config: MtnMomoConfig): Promise<void> {
    this.momoConfig = config;
    this.config = config;
    
    // Validate required fields
    if (!config.subscriptionKey) {
      throw new Error("MTN MoMo: Subscription Key (Ocp-Apim-Subscription-Key) is required");
    }
    
    this.log("initialize", { 
      environment: config.environment,
      baseUrl: this.getBaseUrl(),
    });
    
    this.isInitialized = true;
  }

  private getBaseUrl(): string {
    return this.momoConfig?.environment === "production" 
      ? this.PRODUCTION_URL 
      : this.SANDBOX_URL;
  }

  /**
   * Get OAuth access token
   * Token is valid for 3600 seconds (1 hour)
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    this.ensureInitialized();
    const config = this.momoConfig!;

    try {
      const credentials = btoa(`${config.userId}:${config.userApiKey}`);
      
      const response = await fetch(
        `${this.getBaseUrl()}/collection/token/`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Ocp-Apim-Subscription-Key": config.subscriptionKey!,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Refresh 1 min early
      
      return this.accessToken!;
    } catch (error) {
      this.log("getAccessToken error", error);
      throw new Error("Failed to obtain MTN MoMo access token");
    }
  }

  /**
   * Request payment from customer (Collection)
   * This sends a payment prompt to the customer's phone
   */
  async requestPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.ensureInitialized();
    const config = this.momoConfig!;

    // Validate phone number
    if (!this.isValidPhoneNumber(request.phoneNumber)) {
      return this.createErrorResponse("Invalid phone number format", request);
    }

    const transactionId = this.generateTransactionId();
    const externalId = this.generateReference();
    const formattedPhone = this.formatPhoneNumber(request.phoneNumber);

    try {
      const accessToken = await this.getAccessToken();

      const payload = {
        amount: request.amount.toString(),
        currency: request.currency || "ZMW",
        externalId: externalId,
        payer: {
          partyIdType: "MSISDN",
          partyId: formattedPhone,
        },
        payerMessage: request.description || "LTC FAST TRACK Payment",
        payeeNote: `Payment for ${request.reference}`,
      };

      this.log("requestPayment", { transactionId, payload });

      const response = await fetch(
        `${this.getBaseUrl()}/collection/v1_0/requesttopay`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "X-Reference-Id": externalId,
            "X-Target-Environment": config.targetEnvironment || "sandbox",
            "Ocp-Apim-Subscription-Key": config.subscriptionKey!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 202) {
        // Request accepted - payment prompt sent to customer
        return this.createSuccessResponse(transactionId, externalId, request, "pending");
      } else {
        const errorData = await response.json().catch(() => ({}));
        this.log("requestPayment error", errorData);
        return this.createErrorResponse(
          errorData.message || `Payment request failed: ${response.status}`,
          request
        );
      }
    } catch (error) {
      this.log("requestPayment exception", error);
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Payment request failed",
        request
      );
    }
  }

  /**
   * Check payment status
   */
  async getPaymentStatus(referenceId: string): Promise<PaymentStatusResponse> {
    this.ensureInitialized();
    const config = this.momoConfig!;

    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.getBaseUrl()}/collection/v1_0/requesttopay/${referenceId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "X-Target-Environment": config.targetEnvironment || "sandbox",
            "Ocp-Apim-Subscription-Key": config.subscriptionKey!,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Map MTN status to our status
      const statusMap: Record<string, PaymentStatusResponse["status"]> = {
        PENDING: "pending",
        SUCCESSFUL: "successful",
        FAILED: "failed",
      };

      return {
        transactionId: referenceId,
        externalId: data.externalId,
        status: statusMap[data.status] || "pending",
        amount: parseFloat(data.amount),
        currency: data.currency,
        provider: "mtn_momo",
        completedAt: data.status === "SUCCESSFUL" ? new Date().toISOString() : undefined,
        failureReason: data.reason,
      };
    } catch (error) {
      this.log("getPaymentStatus error", error);
      throw error;
    }
  }

  /**
   * Verify callback signature from MTN
   */
  verifyCallback(callback: PaymentCallback): boolean {
    // MTN MoMo uses webhook notifications
    // Implement signature verification based on MTN's documentation
    // For now, basic validation
    return !!(
      callback.transactionId &&
      callback.status &&
      callback.amount
    );
  }

  /**
   * Get the receiver number for MTN MoMo
   */
  static getReceiverNumber(): string {
    return PAYMENT_RECEIVERS.mtn_momo;
  }
}

// Export singleton instance
export const mtnMomoService = new MtnMomoService();
