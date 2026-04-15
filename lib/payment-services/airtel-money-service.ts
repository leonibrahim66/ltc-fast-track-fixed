/**
 * Airtel Money Payment Service
 * Integration with Airtel Money API for Zambia
 * 
 * To get API credentials:
 * 1. Contact Airtel Zambia Business team
 * 2. Register as a merchant
 * 3. Get Client ID and Client Secret
 */

import { BasePaymentService } from "./base-service";
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
  PaymentCallback,
  AirtelMoneyConfig,
  PAYMENT_RECEIVERS,
} from "./types";

export class AirtelMoneyService extends BasePaymentService {
  provider: PaymentProvider = "airtel_money";
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private airtelConfig: AirtelMoneyConfig | null = null;

  // Airtel Money API endpoints
  private readonly SANDBOX_URL = "https://openapiuat.airtel.africa";
  private readonly PRODUCTION_URL = "https://openapi.airtel.africa";

  async initialize(config: AirtelMoneyConfig): Promise<void> {
    this.airtelConfig = config;
    this.config = config;
    
    // Validate required fields
    if (!config.clientId || !config.clientSecret) {
      throw new Error("Airtel Money: Client ID and Client Secret are required");
    }
    
    this.log("initialize", { 
      environment: config.environment,
      baseUrl: this.getBaseUrl(),
    });
    
    this.isInitialized = true;
  }

  private getBaseUrl(): string {
    return this.airtelConfig?.environment === "production" 
      ? this.PRODUCTION_URL 
      : this.SANDBOX_URL;
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    this.ensureInitialized();
    const config = this.airtelConfig!;

    try {
      const response = await fetch(
        `${this.getBaseUrl()}/auth/oauth2/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            grant_type: config.grantType || "client_credentials",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
      
      return this.accessToken!;
    } catch (error) {
      this.log("getAccessToken error", error);
      throw new Error("Failed to obtain Airtel Money access token");
    }
  }

  /**
   * Request payment from customer (Collection)
   */
  async requestPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.ensureInitialized();

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
        reference: externalId,
        subscriber: {
          country: "ZM",
          currency: request.currency || "ZMW",
          msisdn: formattedPhone.replace(/^260/, ""), // Airtel expects number without country code
        },
        transaction: {
          amount: request.amount,
          country: "ZM",
          currency: request.currency || "ZMW",
          id: externalId,
        },
      };

      this.log("requestPayment", { transactionId, payload });

      const response = await fetch(
        `${this.getBaseUrl()}/merchant/v1/payments/`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Country": "ZM",
            "X-Currency": "ZMW",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (response.ok && data.status?.success) {
        return this.createSuccessResponse(transactionId, externalId, request, "pending");
      } else {
        this.log("requestPayment error", data);
        return this.createErrorResponse(
          data.status?.message || `Payment request failed: ${response.status}`,
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
  async getPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    this.ensureInitialized();

    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.getBaseUrl()}/standard/v1/payments/${transactionId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "X-Country": "ZM",
            "X-Currency": "ZMW",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Map Airtel status to our status
      const statusMap: Record<string, PaymentStatusResponse["status"]> = {
        TS: "successful",  // Transaction Successful
        TF: "failed",      // Transaction Failed
        TA: "pending",     // Transaction Ambiguous
        TIP: "processing", // Transaction In Progress
      };

      return {
        transactionId: transactionId,
        externalId: data.data?.transaction?.id,
        status: statusMap[data.data?.transaction?.status] || "pending",
        amount: parseFloat(data.data?.transaction?.amount || "0"),
        currency: data.data?.transaction?.currency || "ZMW",
        provider: "airtel_money",
        completedAt: data.data?.transaction?.status === "TS" 
          ? new Date().toISOString() 
          : undefined,
        failureReason: data.data?.transaction?.message,
      };
    } catch (error) {
      this.log("getPaymentStatus error", error);
      throw error;
    }
  }

  /**
   * Verify callback signature from Airtel
   */
  verifyCallback(callback: PaymentCallback): boolean {
    // Implement signature verification based on Airtel's documentation
    return !!(
      callback.transactionId &&
      callback.status &&
      callback.amount
    );
  }

  /**
   * Get the receiver number for Airtel Money
   */
  static getReceiverNumber(): string {
    return PAYMENT_RECEIVERS.airtel_money;
  }
}

// Export singleton instance
export const airtelMoneyService = new AirtelMoneyService();
