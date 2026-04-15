/**
 * Payment Gateway Manager
 * Unified interface for all payment providers
 * Handles provider selection, initialization, and payment processing
 */

import {
  PaymentProvider,
  PaymentProviderConfig,
  PaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
  PaymentCallback,
  IPaymentService,
  MtnMomoConfig,
  AirtelMoneyConfig,
  PAYMENT_RECEIVERS,
  CURRENCY,
} from "./types";
import { MtnMomoService } from "./mtn-momo-service";
import { AirtelMoneyService } from "./airtel-money-service";

interface PaymentGatewayConfig {
  environment: "sandbox" | "production";
  mtnMomo?: Omit<MtnMomoConfig, "provider" | "environment">;
  airtelMoney?: Omit<AirtelMoneyConfig, "provider" | "environment">;
}

class PaymentGateway {
  private services: Map<PaymentProvider, IPaymentService> = new Map();
  private environment: "sandbox" | "production" = "sandbox";
  private isInitialized = false;

  /**
   * Initialize the payment gateway with provider configurations
   */
  async initialize(config: PaymentGatewayConfig): Promise<void> {
    this.environment = config.environment;

    // Initialize MTN MoMo if configured
    if (config.mtnMomo) {
      const mtnService = new MtnMomoService();
      await mtnService.initialize({
        ...config.mtnMomo,
        provider: "mtn_momo",
        environment: this.environment,
        receiverNumber: PAYMENT_RECEIVERS.mtn_momo,
      } as MtnMomoConfig);
      this.services.set("mtn_momo", mtnService);
    }

    // Initialize Airtel Money if configured
    if (config.airtelMoney) {
      const airtelService = new AirtelMoneyService();
      await airtelService.initialize({
        ...config.airtelMoney,
        provider: "airtel_money",
        environment: this.environment,
        receiverNumber: PAYMENT_RECEIVERS.airtel_money,
      } as AirtelMoneyConfig);
      this.services.set("airtel_money", airtelService);
    }

    this.isInitialized = true;
    console.log(`[PaymentGateway] Initialized in ${this.environment} mode with ${this.services.size} provider(s)`);
  }

  /**
   * Get available payment providers
   */
  getAvailableProviders(): PaymentProvider[] {
    return Array.from(this.services.keys());
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: PaymentProvider): boolean {
    return this.services.has(provider);
  }

  /**
   * Request a payment from customer
   */
  async requestPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const service = this.services.get(request.provider);
    
    if (!service) {
      return {
        success: false,
        transactionId: `err_${Date.now()}`,
        status: "failed",
        message: `Payment provider ${request.provider} is not configured`,
        provider: request.provider,
        amount: request.amount,
        currency: request.currency,
        phoneNumber: request.phoneNumber,
        reference: request.reference,
        timestamp: new Date().toISOString(),
      };
    }

    return service.requestPayment(request);
  }

  /**
   * Check payment status
   */
  async getPaymentStatus(
    provider: PaymentProvider,
    transactionId: string
  ): Promise<PaymentStatusResponse> {
    const service = this.services.get(provider);
    
    if (!service) {
      throw new Error(`Payment provider ${provider} is not configured`);
    }

    return service.getPaymentStatus(transactionId);
  }

  /**
   * Verify a payment callback
   */
  verifyCallback(provider: PaymentProvider, callback: PaymentCallback): boolean {
    const service = this.services.get(provider);
    
    if (!service) {
      return false;
    }

    return service.verifyCallback(callback);
  }

  /**
   * Get receiver number for a provider
   */
  getReceiverNumber(provider: PaymentProvider): string {
    return PAYMENT_RECEIVERS[provider as keyof typeof PAYMENT_RECEIVERS] || "";
  }

  /**
   * Get currency configuration
   */
  getCurrency() {
    return CURRENCY;
  }

  /**
   * Check if gateway is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.services.size > 0;
  }

  /**
   * Get current environment
   */
  getEnvironment(): "sandbox" | "production" {
    return this.environment;
  }
}

// Export singleton instance
export const paymentGateway = new PaymentGateway();

// Export for direct access
export { PaymentGateway };
