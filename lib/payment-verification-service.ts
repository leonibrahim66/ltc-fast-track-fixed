/**
 * Payment Verification Service
 * Integrates with payment system to auto-approve verified payments
 */

export type PaymentStatus = 'pending' | 'verified' | 'failed' | 'cancelled';
export type PaymentMethod = 'mtn' | 'airtel' | 'zamtel' | 'bank';

export interface PaymentRecord {
  id: string;
  requestId: string;
  amount: number;
  method: PaymentMethod;
  transactionId: string;
  status: PaymentStatus;
  verifiedAt?: number;
  verifiedBy?: string;
  timestamp: number;
  screenshotUrl?: string;
}

export interface PaymentVerificationResult {
  isVerified: boolean;
  paymentId: string;
  requestId: string;
  amount: number;
  method: PaymentMethod;
  verificationTime: number;
  reason?: string;
}

export class PaymentVerificationService {
  private payments: Map<string, PaymentRecord> = new Map();
  private verificationRules: Map<PaymentMethod, (payment: PaymentRecord) => boolean> = new Map();

  constructor() {
    this.initializeVerificationRules();
  }

  /**
   * Initialize payment verification rules
   */
  private initializeVerificationRules() {
    // MTN verification rule
    this.verificationRules.set('mtn', (payment: PaymentRecord) => {
      return !!(payment.transactionId &&
        payment.transactionId.length >= 8 &&
        payment.amount > 0 &&
        payment.screenshotUrl !== undefined);
    });

    // Airtel verification rule
    this.verificationRules.set('airtel', (payment: PaymentRecord) => {
      return !!(payment.transactionId &&
        payment.transactionId.length >= 8 &&
        payment.amount > 0 &&
        payment.screenshotUrl !== undefined);
    });

    // Zamtel verification rule
    this.verificationRules.set('zamtel', (payment: PaymentRecord) => {
      return !!(payment.transactionId &&
        payment.transactionId.length >= 8 &&
        payment.amount > 0 &&
        payment.screenshotUrl !== undefined);
    });

    // Bank verification rule
    this.verificationRules.set('bank', (payment: PaymentRecord) => {
      return !!(payment.transactionId &&
        payment.transactionId.length >= 10 &&
        payment.amount > 0);
    });
  }

  /**
   * Register a payment
   */
  registerPayment(
    requestId: string,
    amount: number,
    method: PaymentMethod,
    transactionId: string,
    screenshotUrl?: string
  ): PaymentRecord {
    const payment: PaymentRecord = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      requestId,
      amount,
      method,
      transactionId,
      status: 'pending',
      timestamp: Date.now(),
      screenshotUrl,
    };

    this.payments.set(payment.id, payment);
    return payment;
  }

  /**
   * Verify a payment
   */
  verifyPayment(paymentId: string, adminId: string): PaymentVerificationResult {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    // Check verification rules
    const rule = this.verificationRules.get(payment.method);
    if (!rule) {
      throw new Error(`No verification rule for method ${payment.method}`);
    }

    const isVerified = rule(payment);

    if (isVerified) {
      payment.status = 'verified';
      payment.verifiedAt = Date.now();
      payment.verifiedBy = adminId;
    } else {
      payment.status = 'failed';
    }

    this.payments.set(paymentId, payment);

    return {
      isVerified,
      paymentId: payment.id,
      requestId: payment.requestId,
      amount: payment.amount,
      method: payment.method,
      verificationTime: Date.now(),
      reason: isVerified ? 'Payment verified successfully' : 'Payment verification failed - missing required fields',
    };
  }

  /**
   * Get payment by request ID
   */
  getPaymentByRequestId(requestId: string): PaymentRecord | undefined {
    for (const payment of this.payments.values()) {
      if (payment.requestId === requestId) {
        return payment;
      }
    }
    return undefined;
  }

  /**
   * Check if payment is verified for a request
   */
  isPaymentVerified(requestId: string): boolean {
    const payment = this.getPaymentByRequestId(requestId);
    return payment ? payment.status === 'verified' : false;
  }

  /**
   * Get payment status for a request
   */
  getPaymentStatus(requestId: string): PaymentStatus | null {
    const payment = this.getPaymentByRequestId(requestId);
    return payment ? payment.status : null;
  }

  /**
   * Get all payments
   */
  getAllPayments(): PaymentRecord[] {
    return Array.from(this.payments.values());
  }

  /**
   * Get payments by status
   */
  getPaymentsByStatus(status: PaymentStatus): PaymentRecord[] {
    return Array.from(this.payments.values()).filter(p => p.status === status);
  }

  /**
   * Get payments by method
   */
  getPaymentsByMethod(method: PaymentMethod): PaymentRecord[] {
    return Array.from(this.payments.values()).filter(p => p.method === method);
  }

  /**
   * Get verified payments
   */
  getVerifiedPayments(): PaymentRecord[] {
    return this.getPaymentsByStatus('verified');
  }

  /**
   * Get pending payments
   */
  getPendingPayments(): PaymentRecord[] {
    return this.getPaymentsByStatus('pending');
  }

  /**
   * Get failed payments
   */
  getFailedPayments(): PaymentRecord[] {
    return this.getPaymentsByStatus('failed');
  }

  /**
   * Reject a payment
   */
  rejectPayment(paymentId: string, reason: string): PaymentRecord {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    payment.status = 'failed';
    this.payments.set(paymentId, payment);
    return payment;
  }

  /**
   * Get payment statistics
   */
  getStatistics() {
    const allPayments = this.getAllPayments();
    return {
      total: allPayments.length,
      verified: this.getVerifiedPayments().length,
      pending: this.getPendingPayments().length,
      failed: this.getFailedPayments().length,
      totalAmount: allPayments.reduce((sum, p) => sum + p.amount, 0),
      verificationRate: allPayments.length > 0
        ? (this.getVerifiedPayments().length / allPayments.length) * 100
        : 0,
      byMethod: {
        mtn: this.getPaymentsByMethod('mtn').length,
        airtel: this.getPaymentsByMethod('airtel').length,
        zamtel: this.getPaymentsByMethod('zamtel').length,
        bank: this.getPaymentsByMethod('bank').length,
      },
    };
  }

  /**
   * Validate payment amount
   */
  validatePaymentAmount(requestId: string, expectedAmount: number): boolean {
    const payment = this.getPaymentByRequestId(requestId);
    if (!payment) return false;
    return Math.abs(payment.amount - expectedAmount) < 0.01; // Allow for floating point errors
  }

  /**
   * Get payment verification details
   */
  getPaymentDetails(paymentId: string): PaymentRecord | undefined {
    return this.payments.get(paymentId);
  }

  /**
   * Batch verify payments
   */
  batchVerifyPayments(paymentIds: string[], adminId: string): PaymentVerificationResult[] {
    return paymentIds.map(id => {
      try {
        return this.verifyPayment(id, adminId);
      } catch (error) {
        return {
          isVerified: false,
          paymentId: id,
          requestId: '',
          amount: 0,
          method: 'mtn',
          verificationTime: Date.now(),
          reason: `Error verifying payment: ${error}`,
        };
      }
    });
  }

  /**
   * Auto-approve verified payments
   */
  getAutoApprovalCandidates(): string[] {
    return this.getVerifiedPayments().map(p => p.requestId);
  }

  /**
   * Auto-reject failed payments
   */
  getAutoRejectionCandidates(): string[] {
    return this.getFailedPayments().map(p => p.requestId);
  }
}

// Create singleton instance
export const paymentVerificationService = new PaymentVerificationService();
