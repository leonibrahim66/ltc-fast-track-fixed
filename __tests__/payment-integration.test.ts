import { describe, it, expect, beforeEach } from 'vitest';
import { ZynlepayIntegrationService, type PaymentScreenData } from '../lib/zynlepay-integration';
import { PaymentWebhookService, type WebhookEvent } from '../lib/payment-webhook-service';
import { PaymentDashboardService, type TransactionRecord } from '../lib/payment-dashboard-service';

describe('Zynlepay Payment Integration', () => {
  let integrationService: ZynlepayIntegrationService;
  let webhookService: PaymentWebhookService;
  let dashboardService: PaymentDashboardService;

  beforeEach(() => {
    integrationService = new ZynlepayIntegrationService();
    webhookService = new PaymentWebhookService();
    dashboardService = new PaymentDashboardService();
  });

  describe('Payment Screen Integration', () => {
    it('should process subscription payment', async () => {
      const paymentData: PaymentScreenData = {
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        userEmail: 'john@example.com',
        userPhone: '+260960123456',
        paymentType: 'subscription',
        amount: 180,
        description: 'Premium Subscription',
        metadata: { subscriptionPlan: 'Premium' },
      };

      const result = await integrationService.processSubscriptionPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeTruthy();
      expect(result.paymentUrl).toBeTruthy();
    });

    it('should process affiliation fee payment', async () => {
      const paymentData: PaymentScreenData = {
        requestId: 'req-002',
        userId: 'user-002',
        userName: 'Peter Chanda',
        userEmail: 'peter@example.com',
        userPhone: '+260962345678',
        paymentType: 'affiliation_fee',
        amount: 350,
        description: 'Collector Affiliation Fee',
        metadata: { vehicleType: 'light_truck' },
      };

      const result = await integrationService.processAffiliationFeePayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeTruthy();
    });

    it('should reject invalid payment data', async () => {
      const invalidData: any = {
        requestId: 'req-001',
        // Missing required fields
      };

      const result = await integrationService.processSubscriptionPayment(invalidData);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should track payment screen history', async () => {
      const paymentData: PaymentScreenData = {
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        userEmail: 'john@example.com',
        userPhone: '+260960123456',
        paymentType: 'subscription',
        amount: 180,
        description: 'Premium Subscription',
      };

      await integrationService.processSubscriptionPayment(paymentData);

      const history = integrationService.getPaymentScreenHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].requestId).toBe('req-001');
    });
  });

  describe('Webhook Notifications', () => {
    it('should process payment completed webhook', async () => {
      const webhookEvent: WebhookEvent = {
        id: 'webhook-001',
        event: 'payment.completed',
        transactionId: 'ZYN-123456',
        status: 'completed',
        amount: 180,
        currency: 'ZMW',
        timestamp: Date.now(),
        reference: 'REF-123456',
      };

      const result = await webhookService.processWebhookEvent(webhookEvent);

      expect(result).toBe(true);
      const notifications = webhookService.getNotifications();
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should process payment failed webhook', async () => {
      const webhookEvent: WebhookEvent = {
        id: 'webhook-002',
        event: 'payment.failed',
        transactionId: 'ZYN-789012',
        status: 'failed',
        amount: 250,
        currency: 'ZMW',
        timestamp: Date.now(),
      };

      const result = await webhookService.processWebhookEvent(webhookEvent);

      expect(result).toBe(true);
      const failedNotifs = webhookService.getNotificationsByType('payment_failed');
      expect(failedNotifs.length).toBeGreaterThan(0);
    });

    it('should create notifications from webhooks', async () => {
      const webhookEvent: WebhookEvent = {
        id: 'webhook-003',
        event: 'payment.completed',
        transactionId: 'ZYN-345678',
        status: 'completed',
        amount: 350,
        currency: 'ZMW',
        timestamp: Date.now(),
      };

      await webhookService.processWebhookEvent(webhookEvent);

      const notifications = webhookService.getNotifications();
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].title).toBeTruthy();
      expect(notifications[0].message).toBeTruthy();
    });

    it('should track unread notifications', async () => {
      const webhookEvent: WebhookEvent = {
        id: 'webhook-004',
        event: 'payment.completed',
        transactionId: 'ZYN-901234',
        status: 'completed',
        amount: 100,
        currency: 'ZMW',
        timestamp: Date.now(),
      };

      await webhookService.processWebhookEvent(webhookEvent);

      const unread = webhookService.getUnreadNotifications();
      expect(unread.length).toBeGreaterThan(0);

      // Mark as read
      if (unread.length > 0) {
        webhookService.markNotificationAsRead(unread[0].id);
        const stillUnread = webhookService.getUnreadNotifications();
        expect(stillUnread.length).toBe(unread.length - 1);
      }
    });
  });

  describe('Admin Payment Dashboard', () => {
    it('should add transaction records', () => {
      const transaction: TransactionRecord = {
        id: 'trans-001',
        transactionId: 'ZYN-123456',
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        amount: 180,
        status: 'completed',
        paymentMethod: 'mtn_mobile_money',
        timestamp: Date.now(),
        reference: 'REF-123456',
      };

      dashboardService.addTransaction(transaction);

      const metrics = dashboardService.getDashboardMetrics();
      expect(metrics.totalTransactions).toBe(1);
      expect(metrics.completedTransactions).toBe(1);
    });

    it('should calculate dashboard metrics', () => {
      const transaction1: TransactionRecord = {
        id: 'trans-001',
        transactionId: 'ZYN-123456',
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        amount: 180,
        status: 'completed',
        paymentMethod: 'mtn',
        timestamp: Date.now(),
      };

      const transaction2: TransactionRecord = {
        id: 'trans-002',
        transactionId: 'ZYN-789012',
        requestId: 'req-002',
        userId: 'user-002',
        userName: 'Jane Mwale',
        amount: 250,
        status: 'failed',
        paymentMethod: 'airtel',
        timestamp: Date.now(),
      };

      dashboardService.addTransaction(transaction1);
      dashboardService.addTransaction(transaction2);

      const metrics = dashboardService.getDashboardMetrics();

      expect(metrics.totalTransactions).toBe(2);
      expect(metrics.completedTransactions).toBe(1);
      expect(metrics.failedTransactions).toBe(1);
      expect(metrics.totalRevenue).toBe(180);
      expect(metrics.successRate).toBe(50);
    });

    it('should generate revenue chart', () => {
      const transaction: TransactionRecord = {
        id: 'trans-001',
        transactionId: 'ZYN-123456',
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        amount: 180,
        status: 'completed',
        paymentMethod: 'mtn',
        timestamp: Date.now(),
      };

      dashboardService.addTransaction(transaction);

      const chart = dashboardService.getRevenueChart(7);

      expect(chart.length).toBe(7);
      expect(chart[chart.length - 1].revenue).toBeGreaterThan(0);
    });

    it('should get payment method breakdown', () => {
      const transaction1: TransactionRecord = {
        id: 'trans-001',
        transactionId: 'ZYN-123456',
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        amount: 180,
        status: 'completed',
        paymentMethod: 'mtn_mobile_money',
        timestamp: Date.now(),
      };

      const transaction2: TransactionRecord = {
        id: 'trans-002',
        transactionId: 'ZYN-789012',
        requestId: 'req-002',
        userId: 'user-002',
        userName: 'Jane Mwale',
        amount: 250,
        status: 'completed',
        paymentMethod: 'bank_transfer',
        timestamp: Date.now(),
      };

      dashboardService.addTransaction(transaction1);
      dashboardService.addTransaction(transaction2);

      const breakdown = dashboardService.getPaymentMethodBreakdown();

      expect(breakdown.length).toBeGreaterThan(0);
      expect(breakdown.some(b => b.method === 'mtn_mobile_money')).toBe(true);
    });

    it('should get failed payments', () => {
      const transaction: TransactionRecord = {
        id: 'trans-001',
        transactionId: 'ZYN-123456',
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        amount: 180,
        status: 'failed',
        paymentMethod: 'mtn',
        timestamp: Date.now(),
      };

      dashboardService.addTransaction(transaction);

      const failed = dashboardService.getFailedPayments();

      expect(failed.length).toBe(1);
      expect(failed[0].status).toBe('failed');
    });

    it('should search transactions', () => {
      const transaction: TransactionRecord = {
        id: 'trans-001',
        transactionId: 'ZYN-123456',
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        amount: 180,
        status: 'completed',
        paymentMethod: 'mtn',
        timestamp: Date.now(),
      };

      dashboardService.addTransaction(transaction);

      const results = dashboardService.searchTransactions('John');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].userName).toContain('John');
    });

    it('should get transaction history', () => {
      const transaction1: TransactionRecord = {
        id: 'trans-001',
        transactionId: 'ZYN-123456',
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        amount: 180,
        status: 'completed',
        paymentMethod: 'mtn',
        timestamp: Date.now() - 1000,
      };

      const transaction2: TransactionRecord = {
        id: 'trans-002',
        transactionId: 'ZYN-789012',
        requestId: 'req-002',
        userId: 'user-002',
        userName: 'Jane Mwale',
        amount: 250,
        status: 'completed',
        paymentMethod: 'airtel',
        timestamp: Date.now(),
      };

      dashboardService.addTransaction(transaction1);
      dashboardService.addTransaction(transaction2);

      const history = dashboardService.getTransactionHistory(10, 0);

      expect(history.length).toBe(2);
      // Should be sorted by timestamp descending
      expect(history[0].timestamp).toBeGreaterThanOrEqual(history[1].timestamp);
    });

    it('should create alerts for high failure rate', () => {
      // Add multiple failed transactions
      for (let i = 0; i < 12; i++) {
        const transaction: TransactionRecord = {
          id: `trans-${i}`,
          transactionId: `ZYN-${i}`,
          requestId: `req-${i}`,
          userId: `user-${i}`,
          userName: `User ${i}`,
          amount: 100,
          status: i < 2 ? 'completed' : 'failed',
          paymentMethod: 'mtn',
          timestamp: Date.now(),
        };
        dashboardService.addTransaction(transaction);
      }

      const alerts = dashboardService.getActiveAlerts();

      expect(alerts.some(a => a.type === 'high_failure_rate')).toBe(true);
    });

    it('should get reconciliation report', () => {
      const transaction1: TransactionRecord = {
        id: 'trans-001',
        transactionId: 'ZYN-123456',
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        amount: 180,
        status: 'completed',
        paymentMethod: 'mtn',
        timestamp: Date.now(),
      };

      const transaction2: TransactionRecord = {
        id: 'trans-002',
        transactionId: 'ZYN-789012',
        requestId: 'req-002',
        userId: 'user-002',
        userName: 'Jane Mwale',
        amount: 250,
        status: 'failed',
        paymentMethod: 'airtel',
        timestamp: Date.now(),
      };

      dashboardService.addTransaction(transaction1);
      dashboardService.addTransaction(transaction2);

      const report = dashboardService.getReconciliationReport();

      expect(report.totalExpected).toBe(430);
      expect(report.totalReceived).toBe(180);
      expect(report.discrepancy).toBe(250);
    });

    it('should export dashboard data', () => {
      const transaction: TransactionRecord = {
        id: 'trans-001',
        transactionId: 'ZYN-123456',
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        amount: 180,
        status: 'completed',
        paymentMethod: 'mtn',
        timestamp: Date.now(),
      };

      dashboardService.addTransaction(transaction);

      const jsonExport = dashboardService.exportDashboardData('json');
      const csvExport = dashboardService.exportDashboardData('csv');

      expect(jsonExport).toContain('metrics');
      expect(csvExport).toContain('Transaction ID');
    });

    it('should update transaction status', () => {
      const transaction: TransactionRecord = {
        id: 'trans-001',
        transactionId: 'ZYN-123456',
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        amount: 180,
        status: 'pending',
        paymentMethod: 'mtn',
        timestamp: Date.now(),
      };

      dashboardService.addTransaction(transaction);

      const updated = dashboardService.updateTransactionStatus('ZYN-123456', 'completed');

      expect(updated).toBe(true);

      const metrics = dashboardService.getDashboardMetrics();
      expect(metrics.completedTransactions).toBe(1);
    });
  });

  describe('End-to-End Payment Flow', () => {
    it('should handle complete payment flow', async () => {
      // Step 1: Customer initiates payment
      const paymentData: PaymentScreenData = {
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        userEmail: 'john@example.com',
        userPhone: '+260960123456',
        paymentType: 'subscription',
        amount: 180,
        description: 'Premium Subscription',
      };

      const paymentResult = await integrationService.processSubscriptionPayment(paymentData);
      expect(paymentResult.success).toBe(true);

      // Step 2: Webhook notification received
      const webhookEvent: WebhookEvent = {
        id: 'webhook-001',
        event: 'payment.completed',
        transactionId: paymentResult.transactionId!,
        status: 'completed',
        amount: 180,
        currency: 'ZMW',
        timestamp: Date.now(),
        reference: 'REF-123456',
        metadata: { requestId: 'req-001' },
      };

      const webhookProcessed = await webhookService.processWebhookEvent(webhookEvent);
      expect(webhookProcessed).toBe(true);

      // Step 3: Dashboard records transaction
      const transaction: TransactionRecord = {
        id: 'trans-001',
        transactionId: paymentResult.transactionId!,
        requestId: 'req-001',
        userId: 'user-001',
        userName: 'John Banda',
        amount: 180,
        status: 'completed',
        paymentMethod: 'mtn_mobile_money',
        timestamp: Date.now(),
        reference: 'REF-123456',
      };

      dashboardService.addTransaction(transaction);

      // Step 4: Verify dashboard metrics
      const metrics = dashboardService.getDashboardMetrics();
      expect(metrics.totalTransactions).toBe(1);
      expect(metrics.completedTransactions).toBe(1);
      expect(metrics.totalRevenue).toBe(180);

      // Step 5: Check notifications
      const notifications = webhookService.getNotifications();
      expect(notifications.length).toBeGreaterThan(0);
    });
  });
});
