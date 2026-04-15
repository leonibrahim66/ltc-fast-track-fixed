/**
 * Zynlepay Payment Integration Service
 * Handles integration between app screens and Zynlepay payment processing
 */

import { zynlepayService, type ZynlepayPaymentRequest } from './zynlepay-service';

export interface PaymentScreenData {
  requestId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  paymentType: 'subscription' | 'affiliation_fee';
  amount: number;
  description: string;
  metadata?: Record<string, any>;
}

export interface PaymentIntegrationResult {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  error?: string;
  message: string;
}

export interface PaymentStatusUpdate {
  requestId: string;
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  timestamp: number;
  reference?: string;
}

export class ZynlepayIntegrationService {
  private paymentScreenHistory: PaymentScreenData[] = [];
  private statusUpdates: PaymentStatusUpdate[] = [];
  private webhookLog: any[] = [];

  /**
   * Process subscription payment from screen
   */
  async processSubscriptionPayment(data: PaymentScreenData): Promise<PaymentIntegrationResult> {
    try {
      // Validate data
      this.validatePaymentData(data);

      // Create Zynlepay payment request
      const zynlepayRequest: ZynlepayPaymentRequest = {
        amount: data.amount,
        currency: 'ZMW',
        description: data.description,
        phone: data.userPhone,
        email: data.userEmail,
        firstName: data.userName.split(' ')[0],
        lastName: data.userName.split(' ').slice(1).join(' '),
        metadata: {
          ...data.metadata,
          requestId: data.requestId,
          userId: data.userId,
          paymentType: data.paymentType,
        },
      };

      // Initialize payment with Zynlepay
      const payment = await zynlepayService.initializePayment(zynlepayRequest);

      // Store payment screen history
      this.paymentScreenHistory.push(data);

      // Create initial status update
      const statusUpdate: PaymentStatusUpdate = {
        requestId: data.requestId,
        transactionId: payment.transactionId,
        status: 'pending',
        amount: data.amount,
        timestamp: Date.now(),
      };
      this.statusUpdates.push(statusUpdate);

      return {
        success: true,
        transactionId: payment.transactionId,
        paymentUrl: payment.paymentUrl,
        message: 'Payment initialized successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        message: `Payment initialization failed: ${error}`,
      };
    }
  }

  /**
   * Process collector affiliation fee payment
   */
  async processAffiliationFeePayment(data: PaymentScreenData): Promise<PaymentIntegrationResult> {
    try {
      this.validatePaymentData(data);

      const zynlepayRequest: ZynlepayPaymentRequest = {
        amount: data.amount,
        currency: 'ZMW',
        description: data.description,
        phone: data.userPhone,
        email: data.userEmail,
        firstName: data.userName.split(' ')[0],
        lastName: data.userName.split(' ').slice(1).join(' '),
        metadata: {
          ...data.metadata,
          requestId: data.requestId,
          userId: data.userId,
          paymentType: 'affiliation_fee',
        },
      };

      const payment = await zynlepayService.initializePayment(zynlepayRequest);

      this.paymentScreenHistory.push(data);

      const statusUpdate: PaymentStatusUpdate = {
        requestId: data.requestId,
        transactionId: payment.transactionId,
        status: 'pending',
        amount: data.amount,
        timestamp: Date.now(),
      };
      this.statusUpdates.push(statusUpdate);

      return {
        success: true,
        transactionId: payment.transactionId,
        paymentUrl: payment.paymentUrl,
        message: 'Affiliation fee payment initialized successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        message: `Affiliation fee payment failed: ${error}`,
      };
    }
  }

  /**
   * Handle webhook notification from Zynlepay
   */
  handleWebhookNotification(webhookData: any): PaymentStatusUpdate | null {
    try {
      // Log webhook
      this.webhookLog.push({
        receivedAt: Date.now(),
        data: webhookData,
      });

      // Process webhook through Zynlepay service
      const processed = zynlepayService.handleWebhook(webhookData);
      if (!processed) {
        throw new Error('Webhook processing failed');
      }

      // Find corresponding payment screen data
      const paymentScreenData = this.paymentScreenHistory.find(
        p => p.metadata?.requestId === webhookData.metadata?.requestId
      );

      if (!paymentScreenData) {
        throw new Error('Payment screen data not found');
      }

      // Create status update
      const statusUpdate: PaymentStatusUpdate = {
        requestId: paymentScreenData.requestId,
        transactionId: webhookData.transactionId,
        status: webhookData.status,
        amount: webhookData.amount,
        timestamp: webhookData.timestamp,
        reference: webhookData.reference,
      };

      // Update status
      this.statusUpdates.push(statusUpdate);

      return statusUpdate;
    } catch (error) {
      console.error('Webhook handling error:', error);
      return null;
    }
  }

  /**
   * Get payment status for a request
   */
  getPaymentStatus(requestId: string): PaymentStatusUpdate | undefined {
    // Return the latest status update for this request
    const updates = this.statusUpdates.filter(u => u.requestId === requestId);
    return updates.length > 0 ? updates[updates.length - 1] : undefined;
  }

  /**
   * Get payment screen history
   */
  getPaymentScreenHistory(): PaymentScreenData[] {
    return this.paymentScreenHistory;
  }

  /**
   * Get all status updates
   */
  getAllStatusUpdates(): PaymentStatusUpdate[] {
    return this.statusUpdates;
  }

  /**
   * Get webhook log
   */
  getWebhookLog(): any[] {
    return this.webhookLog;
  }

  /**
   * Get payment statistics for dashboard
   */
  getPaymentStatistics() {
    const allUpdates = this.statusUpdates;
    const completed = allUpdates.filter(u => u.status === 'completed');
    const failed = allUpdates.filter(u => u.status === 'failed');
    const pending = allUpdates.filter(u => u.status === 'pending');

    const totalAmount = allUpdates.reduce((sum, u) => sum + u.amount, 0);
    const completedAmount = completed.reduce((sum, u) => sum + u.amount, 0);

    return {
      total: allUpdates.length,
      completed: completed.length,
      failed: failed.length,
      pending: pending.length,
      totalAmount,
      completedAmount,
      successRate: allUpdates.length > 0 ? (completed.length / allUpdates.length) * 100 : 0,
      failureRate: allUpdates.length > 0 ? (failed.length / allUpdates.length) * 100 : 0,
      averageAmount: allUpdates.length > 0 ? totalAmount / allUpdates.length : 0,
    };
  }

  /**
   * Get daily revenue
   */
  getDailyRevenue(date?: Date): number {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return this.statusUpdates
      .filter(
        u =>
          u.status === 'completed' &&
          u.timestamp >= startOfDay.getTime() &&
          u.timestamp <= endOfDay.getTime()
      )
      .reduce((sum, u) => sum + u.amount, 0);
  }

  /**
   * Get monthly revenue
   */
  getMonthlyRevenue(year: number, month: number): number {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    return this.statusUpdates
      .filter(
        u =>
          u.status === 'completed' &&
          u.timestamp >= startDate.getTime() &&
          u.timestamp <= endDate.getTime()
      )
      .reduce((sum, u) => sum + u.amount, 0);
  }

  /**
   * Get failed payments for reconciliation
   */
  getFailedPayments(): PaymentStatusUpdate[] {
    return this.statusUpdates.filter(u => u.status === 'failed');
  }

  /**
   * Get pending payments
   */
  getPendingPayments(): PaymentStatusUpdate[] {
    return this.statusUpdates.filter(u => u.status === 'pending');
  }

  /**
   * Get completed payments
   */
  getCompletedPayments(): PaymentStatusUpdate[] {
    return this.statusUpdates.filter(u => u.status === 'completed');
  }

  /**
   * Get payment by transaction ID
   */
  getPaymentByTransactionId(transactionId: string): PaymentStatusUpdate | undefined {
    return this.statusUpdates.find(u => u.transactionId === transactionId);
  }

  /**
   * Validate payment data
   */
  private validatePaymentData(data: PaymentScreenData): void {
    if (!data.requestId) throw new Error('Request ID is required');
    if (!data.userId) throw new Error('User ID is required');
    if (!data.userName) throw new Error('User name is required');
    if (!data.userEmail) throw new Error('User email is required');
    if (!data.userPhone) throw new Error('User phone is required');
    if (!data.amount || data.amount <= 0) throw new Error('Valid amount is required');
    if (!data.description) throw new Error('Description is required');
  }

  /**
   * Export payment report
   */
  exportPaymentReport(format: 'json' | 'csv' = 'json'): string {
    const data = {
      generatedAt: new Date().toISOString(),
      statistics: this.getPaymentStatistics(),
      payments: this.statusUpdates,
      webhookLog: this.webhookLog,
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // CSV format
    let csv = 'Request ID,Transaction ID,Status,Amount,Timestamp,Reference\n';
    for (const payment of this.statusUpdates) {
      csv += `${payment.requestId},${payment.transactionId},${payment.status},${payment.amount},${new Date(payment.timestamp).toISOString()},${payment.reference || ''}\n`;
    }
    return csv;
  }
}

// Create singleton instance
export const zynlepayIntegrationService = new ZynlepayIntegrationService();
