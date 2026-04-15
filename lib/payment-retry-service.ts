/**
 * Payment Retry Service
 * Handles payment retry logic with exponential backoff
 */

export interface RetryablePayment {
  id: string;
  transactionId: string;
  requestId: string;
  userId: string;
  amount: number;
  paymentMethod: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  createdAt: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  attemptCount: number;
  maxAttempts: number;
  error?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RetryResult {
  success: boolean;
  payment: RetryablePayment;
  message: string;
  shouldRetry: boolean;
}

export class PaymentRetryService {
  private retryQueue: Map<string, RetryablePayment> = new Map();
  private retryHistory: RetryablePayment[] = [];
  private config: RetryConfig = {
    maxAttempts: 5,
    initialDelayMs: 5000, // 5 seconds
    maxDelayMs: 300000, // 5 minutes
    backoffMultiplier: 2,
  };

  constructor(config?: Partial<RetryConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Add payment to retry queue
   */
  addToRetryQueue(payment: Omit<RetryablePayment, 'attemptCount' | 'status' | 'createdAt' | 'maxAttempts'>): RetryablePayment {
    const retryPayment: RetryablePayment = {
      ...payment,
      status: 'pending',
      createdAt: Date.now(),
      attemptCount: 0,
      maxAttempts: this.config.maxAttempts,
    };

    this.retryQueue.set(retryPayment.id, retryPayment);
    console.log(`[RETRY] Added payment ${payment.id} to retry queue`);

    return retryPayment;
  }

  /**
   * Calculate next retry delay using exponential backoff
   */
  private calculateNextRetryDelay(attemptCount: number): number {
    const delay = Math.min(
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attemptCount),
      this.config.maxDelayMs
    );

    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.max(delay + jitter, this.config.initialDelayMs);
  }

  /**
   * Mark payment as failed and schedule retry
   */
  markAsFailed(paymentId: string, error: string): RetryResult {
    const payment = this.retryQueue.get(paymentId);

    if (!payment) {
      return {
        success: false,
        payment: {} as RetryablePayment,
        message: `Payment ${paymentId} not found in retry queue`,
        shouldRetry: false,
      };
    }

    payment.status = 'failed';
    payment.error = error;
    payment.attemptCount++;
    payment.lastAttemptAt = Date.now();

    const shouldRetry = payment.attemptCount < payment.maxAttempts;

    if (shouldRetry) {
      const nextDelay = this.calculateNextRetryDelay(payment.attemptCount - 1);
      payment.nextRetryAt = Date.now() + nextDelay;

      console.log(
        `[RETRY] Payment ${paymentId} scheduled for retry in ${Math.round(nextDelay / 1000)}s (attempt ${payment.attemptCount}/${payment.maxAttempts})`
      );
    } else {
      console.log(`[RETRY] Payment ${paymentId} exceeded max retry attempts`);
    }

    this.retryHistory.push({ ...payment });

    return {
      success: true,
      payment,
      message: shouldRetry
        ? `Payment scheduled for retry (attempt ${payment.attemptCount})`
        : 'Max retry attempts exceeded',
      shouldRetry,
    };
  }

  /**
   * Mark payment as completed
   */
  markAsCompleted(paymentId: string, transactionId: string): RetryResult {
    const payment = this.retryQueue.get(paymentId);

    if (!payment) {
      return {
        success: false,
        payment: {} as RetryablePayment,
        message: `Payment ${paymentId} not found`,
        shouldRetry: false,
      };
    }

    payment.status = 'completed';
    payment.transactionId = transactionId;
    payment.lastAttemptAt = Date.now();

    this.retryHistory.push({ ...payment });
    this.retryQueue.delete(paymentId);

    console.log(`[RETRY] Payment ${paymentId} marked as completed`);

    return {
      success: true,
      payment,
      message: 'Payment completed successfully',
      shouldRetry: false,
    };
  }

  /**
   * Get payments ready for retry
   */
  getPaymentsReadyForRetry(): RetryablePayment[] {
    const now = Date.now();
    const readyForRetry: RetryablePayment[] = [];

    for (const payment of this.retryQueue.values()) {
      if (
        payment.status === 'failed' &&
        payment.nextRetryAt &&
        payment.nextRetryAt <= now &&
        payment.attemptCount < payment.maxAttempts
      ) {
        readyForRetry.push(payment);
      }
    }

    return readyForRetry;
  }

  /**
   * Get payment status
   */
  getPaymentStatus(paymentId: string): RetryablePayment | undefined {
    return this.retryQueue.get(paymentId);
  }

  /**
   * Get all pending retries
   */
  getPendingRetries(): RetryablePayment[] {
    return Array.from(this.retryQueue.values()).filter(p => p.status === 'failed');
  }

  /**
   * Get retry statistics
   */
  getRetryStatistics() {
    const pending = this.getPendingRetries();
    const completed = this.retryHistory.filter(p => p.status === 'completed');
    const failed = this.retryHistory.filter(p => p.status === 'failed' && p.attemptCount >= p.maxAttempts);

    const totalRetries = this.retryHistory.reduce((sum, p) => sum + (p.attemptCount - 1), 0);
    const successfulRetries = completed.filter(p => p.attemptCount > 1).length;

    return {
      totalPayments: this.retryQueue.size + this.retryHistory.length,
      pendingRetries: pending.length,
      completedPayments: completed.length,
      failedPayments: failed.length,
      totalRetryAttempts: totalRetries,
      successfulRetries,
      retrySuccessRate: completed.length > 0 ? (successfulRetries / completed.length) * 100 : 0,
    };
  }

  /**
   * Get retry history
   */
  getRetryHistory(limit: number = 50): RetryablePayment[] {
    return this.retryHistory.slice(-limit);
  }

  /**
   * Clear completed payments from queue
   */
  clearCompletedPayments(): number {
    let cleared = 0;

    for (const [id, payment] of this.retryQueue.entries()) {
      if (payment.status === 'completed') {
        this.retryQueue.delete(id);
        cleared++;
      }
    }

    console.log(`[RETRY] Cleared ${cleared} completed payments from queue`);
    return cleared;
  }

  /**
   * Get retry queue size
   */
  getQueueSize(): number {
    return this.retryQueue.size;
  }

  /**
   * Update retry config
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[RETRY] Configuration updated:', this.config);
  }

  /**
   * Get current config
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Reset service (clear all data)
   */
  reset(): void {
    this.retryQueue.clear();
    this.retryHistory = [];
    console.log('[RETRY] Service reset');
  }

  /**
   * Get payment details for user
   */
  getUserPayments(userId: string): RetryablePayment[] {
    return Array.from(this.retryQueue.values()).filter(p => p.userId === userId);
  }

  /**
   * Get payments by status
   */
  getPaymentsByStatus(status: RetryablePayment['status']): RetryablePayment[] {
    return Array.from(this.retryQueue.values()).filter(p => p.status === status);
  }

  /**
   * Calculate total amount pending
   */
  getTotalPendingAmount(): number {
    return Array.from(this.retryQueue.values()).reduce((sum, p) => sum + p.amount, 0);
  }

  /**
   * Get next retry time for payment
   */
  getNextRetryTime(paymentId: string): number | null {
    const payment = this.retryQueue.get(paymentId);
    return payment?.nextRetryAt || null;
  }

  /**
   * Get time until next retry (in seconds)
   */
  getTimeUntilNextRetry(paymentId: string): number | null {
    const nextRetryTime = this.getNextRetryTime(paymentId);
    if (!nextRetryTime) return null;

    const timeUntil = Math.max(0, nextRetryTime - Date.now());
    return Math.ceil(timeUntil / 1000);
  }
}

// Create singleton instance
export const paymentRetryService = new PaymentRetryService();
