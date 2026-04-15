/**
 * Zynlepay Payment Gateway Service
 * Handles all payment processing through Zynlepay API
 */

export type PaymentMethodType = 'mobile_money' | 'bank_transfer' | 'card';
export type PaymentStatusType = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface ZynlepayPaymentRequest {
  amount: number;
  currency: string;
  description: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, any>;
}

export interface ZynlepayPaymentResponse {
  transactionId: string;
  status: PaymentStatusType;
  amount: number;
  currency: string;
  timestamp: number;
  paymentUrl?: string;
  reference?: string;
}

export interface ZynlepayWebhookPayload {
  event: string;
  transactionId: string;
  status: PaymentStatusType;
  amount: number;
  currency: string;
  timestamp: number;
  reference?: string;
  metadata?: Record<string, any>;
}

export class ZynlepayService {
  private merchantCode: string;
  private apiKey: string;
  private apiId: string;
  private baseUrl: string = 'https://api.zynlepay.com/v1';
  private transactions: Map<string, ZynlepayPaymentResponse> = new Map();
  private webhookHistory: ZynlepayWebhookPayload[] = [];

  constructor(merchantCode: string, apiKey: string, apiId: string) {
    this.merchantCode = merchantCode;
    this.apiKey = apiKey;
    this.apiId = apiId;
  }

  /**
   * Initialize payment request
   */
  async initializePayment(request: ZynlepayPaymentRequest): Promise<ZynlepayPaymentResponse> {
    try {
      // Validate request
      this.validatePaymentRequest(request);

      // Create transaction ID
      const transactionId = this.generateTransactionId();

      // Prepare payload
      const payload = {
        merchant_code: this.merchantCode,
        amount: request.amount,
        currency: request.currency || 'ZMW',
        description: request.description,
        phone: request.phone,
        email: request.email,
        first_name: request.firstName,
        last_name: request.lastName,
        transaction_id: transactionId,
        metadata: request.metadata || {},
      };

      // Create request signature
      const signature = this.createSignature(payload);

      // Make API request
      const response = await this.makeApiRequest('/payments/initialize', 'POST', payload, signature);

      // Store transaction
      const paymentResponse: ZynlepayPaymentResponse = {
        transactionId,
        status: 'pending',
        amount: request.amount,
        currency: request.currency || 'ZMW',
        timestamp: Date.now(),
        paymentUrl: response.payment_url,
        reference: response.reference,
      };

      this.transactions.set(transactionId, paymentResponse);
      return paymentResponse;
    } catch (error) {
      throw new Error(`Failed to initialize payment: ${error}`);
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(transactionId: string): Promise<ZynlepayPaymentResponse> {
    try {
      // Get existing transaction
      const existingTransaction = this.transactions.get(transactionId);
      if (existingTransaction) {
        return existingTransaction;
      }

      const payload = {
        merchant_code: this.merchantCode,
        transaction_id: transactionId,
      };

      const signature = this.createSignature(payload);
      const response = await this.makeApiRequest('/payments/verify', 'POST', payload, signature);

      const paymentResponse: ZynlepayPaymentResponse = {
        transactionId,
        status: response.status as PaymentStatusType,
        amount: response.amount || 0,
        currency: response.currency || 'ZMW',
        timestamp: Date.now(),
        reference: response.reference,
      };

      this.transactions.set(transactionId, paymentResponse);
      return paymentResponse;
    } catch (error) {
      throw new Error(`Failed to verify payment: ${error}`);
    }
  }

  /**
   * Get transaction details
   */
  getTransaction(transactionId: string): ZynlepayPaymentResponse | undefined {
    return this.transactions.get(transactionId);
  }

  /**
   * Get all transactions
   */
  getAllTransactions(): ZynlepayPaymentResponse[] {
    return Array.from(this.transactions.values());
  }

  /**
   * Get transactions by status
   */
  getTransactionsByStatus(status: PaymentStatusType): ZynlepayPaymentResponse[] {
    return Array.from(this.transactions.values()).filter(t => t.status === status);
  }

  /**
   * Handle webhook payload
   */
  handleWebhook(payload: ZynlepayWebhookPayload): boolean {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(payload)) {
        throw new Error('Invalid webhook signature');
      }

      // Store webhook
      this.webhookHistory.push(payload);

      // Update transaction status
      const transaction = this.transactions.get(payload.transactionId);
      if (transaction) {
        transaction.status = payload.status;
        transaction.timestamp = payload.timestamp;
        this.transactions.set(payload.transactionId, transaction);
      }

      return true;
    } catch (error) {
      console.error('Webhook processing error:', error);
      return false;
    }
  }

  /**
   * Get webhook history
   */
  getWebhookHistory(): ZynlepayWebhookPayload[] {
    return this.webhookHistory;
  }

  /**
   * Get completed payments
   */
  getCompletedPayments(): ZynlepayPaymentResponse[] {
    return this.getTransactionsByStatus('completed');
  }

  /**
   * Get failed payments
   */
  getFailedPayments(): ZynlepayPaymentResponse[] {
    return this.getTransactionsByStatus('failed');
  }

  /**
   * Get pending payments
   */
  getPendingPayments(): ZynlepayPaymentResponse[] {
    return this.getTransactionsByStatus('pending');
  }

  /**
   * Calculate total revenue
   */
  getTotalRevenue(): number {
    return this.getCompletedPayments().reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * Get payment statistics
   */
  getStatistics() {
    const all = this.getAllTransactions();
    const completed = this.getCompletedPayments();
    const failed = this.getFailedPayments();
    const pending = this.getPendingPayments();

    return {
      total: all.length,
      completed: completed.length,
      failed: failed.length,
      pending: pending.length,
      totalAmount: all.reduce((sum, t) => sum + t.amount, 0),
      completedAmount: completed.reduce((sum, t) => sum + t.amount, 0),
      successRate: all.length > 0 ? (completed.length / all.length) * 100 : 0,
      averageAmount: all.length > 0 ? all.reduce((sum, t) => sum + t.amount, 0) / all.length : 0,
    };
  }

  /**
   * Validate payment request
   */
  private validatePaymentRequest(request: ZynlepayPaymentRequest): void {
    if (!request.amount || request.amount <= 0) {
      throw new Error('Invalid amount');
    }
    if (!request.description) {
      throw new Error('Description is required');
    }
  }

  /**
   * Generate transaction ID
   */
  private generateTransactionId(): string {
    return `ZYN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * Create request signature
   */
  private createSignature(payload: Record<string, any>): string {
    // Create signature from payload and API key
    const payloadString = JSON.stringify(payload);
    const signatureData = `${payloadString}${this.apiKey}`;
    
    // Simple hash (in production, use HMAC-SHA256)
    let hash = 0;
    for (let i = 0; i < signatureData.length; i++) {
      const char = signatureData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(payload: ZynlepayWebhookPayload): boolean {
    // In production, verify the webhook signature from Zynlepay
    // For now, just check that required fields exist
    return !!(payload.transactionId && payload.status && payload.timestamp);
  }

  /**
   * Make API request
   */
  private async makeApiRequest(
    endpoint: string,
    method: string,
    payload: Record<string, any>,
    signature: string
  ): Promise<any> {
    try {
      // Simulate API request
      // In production, use fetch or axios
      const response = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            status: 'pending',
            payment_url: `https://checkout.zynlepay.com/${payload.transaction_id}`,
            reference: `REF-${Date.now()}`,
            amount: payload.amount,
            currency: payload.currency,
          });
        }, 100);
      });

      return response;
    } catch (error) {
      throw new Error(`API request failed: ${error}`);
    }
  }

  /**
   * Get credentials (for testing)
   */
  getCredentials() {
    return {
      merchantCode: this.merchantCode,
      hasApiKey: !!this.apiKey,
      hasApiId: !!this.apiId,
    };
  }
}

// Create singleton instance from environment variables
const merchantCode = process.env.ZYNLEPAY_MERCHANT_CODE || '';
const apiKey = process.env.ZYNLEPAY_API_KEY || '';
const apiId = process.env.ZYNLEPAY_API_ID || '';

export const zynlepayService = new ZynlepayService(merchantCode, apiKey, apiId);
