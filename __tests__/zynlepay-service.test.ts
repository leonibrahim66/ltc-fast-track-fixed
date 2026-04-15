import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZynlepayService, type ZynlepayPaymentRequest } from '../lib/zynlepay-service';

describe('Zynlepay Payment Service', () => {
  let zynlepayService: ZynlepayService;

  beforeEach(() => {
    // Initialize with test credentials
    zynlepayService = new ZynlepayService(
      'MEC01371',
      '4e16b8bf-5b53-4364-9730-1f39eab96c55',
      '4b2df33c-fc0a-4e5c-9187-34b2a15f33a8'
    );
  });

  describe('Credentials', () => {
    it('should store merchant credentials', () => {
      const credentials = zynlepayService.getCredentials();
      expect(credentials.merchantCode).toBe('MEC01371');
      expect(credentials.hasApiKey).toBe(true);
      expect(credentials.hasApiId).toBe(true);
    });

    it('should have all required credentials', () => {
      const credentials = zynlepayService.getCredentials();
      expect(credentials.merchantCode).toBeTruthy();
      expect(credentials.hasApiKey).toBe(true);
      expect(credentials.hasApiId).toBe(true);
    });
  });

  describe('Payment Initialization', () => {
    it('should initialize a payment request', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 180,
        currency: 'ZMW',
        description: 'LTC FAST TRACK - Premium Subscription',
        phone: '+260960123456',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Banda',
      };

      const response = await zynlepayService.initializePayment(request);

      expect(response.transactionId).toBeTruthy();
      expect(response.status).toBe('pending');
      expect(response.amount).toBe(180);
      expect(response.currency).toBe('ZMW');
      expect(response.paymentUrl).toBeTruthy();
    });

    it('should reject invalid amount', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: -100,
        currency: 'ZMW',
        description: 'Test',
      };

      await expect(zynlepayService.initializePayment(request)).rejects.toThrow();
    });

    it('should reject zero amount', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 0,
        currency: 'ZMW',
        description: 'Test',
      };

      await expect(zynlepayService.initializePayment(request)).rejects.toThrow();
    });

    it('should require description', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 100,
        currency: 'ZMW',
        description: '',
      };

      await expect(zynlepayService.initializePayment(request)).rejects.toThrow();
    });

    it('should support different currencies', async () => {
      const currencies = ['ZMW', 'USD', 'GBP'];

      for (const currency of currencies) {
        const request: ZynlepayPaymentRequest = {
          amount: 100,
          currency,
          description: `Test payment in ${currency}`,
        };

        const response = await zynlepayService.initializePayment(request);
        expect(response.currency).toBe(currency);
      }
    });
  });

  describe('Payment Verification', () => {
    it('should verify payment status', async () => {
      const initRequest: ZynlepayPaymentRequest = {
        amount: 250,
        currency: 'ZMW',
        description: 'Test payment',
      };

      const initResponse = await zynlepayService.initializePayment(initRequest);
      const verifyResponse = await zynlepayService.verifyPayment(initResponse.transactionId);

      expect(verifyResponse.transactionId).toBe(initResponse.transactionId);
      expect(verifyResponse.amount).toBeGreaterThan(0);
      expect(verifyResponse.status).toBeDefined();
    });

    it('should track transaction details', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 180,
        currency: 'ZMW',
        description: 'Premium subscription',
        phone: '+260960123456',
      };

      const response = await zynlepayService.initializePayment(request);
      const transaction = zynlepayService.getTransaction(response.transactionId);

      expect(transaction).toBeDefined();
      expect(transaction?.amount).toBe(180);
      expect(transaction?.status).toBe('pending');
    });
  });

  describe('Transaction Management', () => {
    it('should retrieve all transactions', async () => {
      const request1: ZynlepayPaymentRequest = {
        amount: 100,
        currency: 'ZMW',
        description: 'Payment 1',
      };

      const request2: ZynlepayPaymentRequest = {
        amount: 200,
        currency: 'ZMW',
        description: 'Payment 2',
      };

      await zynlepayService.initializePayment(request1);
      await zynlepayService.initializePayment(request2);

      const transactions = zynlepayService.getAllTransactions();
      expect(transactions.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter transactions by status', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 150,
        currency: 'ZMW',
        description: 'Test payment',
      };

      await zynlepayService.initializePayment(request);

      const pending = zynlepayService.getPendingPayments();
      expect(pending.length).toBeGreaterThan(0);
      expect(pending.every(t => t.status === 'pending')).toBe(true);
    });

    it('should get completed payments', async () => {
      const completed = zynlepayService.getCompletedPayments();
      expect(Array.isArray(completed)).toBe(true);
    });

    it('should get failed payments', async () => {
      const failed = zynlepayService.getFailedPayments();
      expect(Array.isArray(failed)).toBe(true);
    });
  });

  describe('Webhook Handling', () => {
    it('should process webhook payload', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 180,
        currency: 'ZMW',
        description: 'Test payment',
      };

      const response = await zynlepayService.initializePayment(request);

      const webhookPayload = {
        event: 'payment.completed',
        transactionId: response.transactionId,
        status: 'completed' as const,
        amount: 180,
        currency: 'ZMW',
        timestamp: Date.now(),
        reference: 'REF-123456',
      };

      const result = zynlepayService.handleWebhook(webhookPayload);
      expect(result).toBe(true);
    });

    it('should update transaction status from webhook', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 250,
        currency: 'ZMW',
        description: 'Test payment',
      };

      const response = await zynlepayService.initializePayment(request);
      expect(response.status).toBe('pending');

      const webhookPayload = {
        event: 'payment.completed',
        transactionId: response.transactionId,
        status: 'completed' as const,
        amount: 250,
        currency: 'ZMW',
        timestamp: Date.now(),
      };

      zynlepayService.handleWebhook(webhookPayload);

      const updated = zynlepayService.getTransaction(response.transactionId);
      expect(updated?.status).toBe('completed');
    });

    it('should store webhook history', async () => {
      const webhookPayload = {
        event: 'payment.completed',
        transactionId: 'ZYN-TEST-123',
        status: 'completed' as const,
        amount: 100,
        currency: 'ZMW',
        timestamp: Date.now(),
      };

      zynlepayService.handleWebhook(webhookPayload);

      const history = zynlepayService.getWebhookHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Payment Statistics', () => {
    it('should calculate payment statistics', async () => {
      const request1: ZynlepayPaymentRequest = {
        amount: 100,
        currency: 'ZMW',
        description: 'Payment 1',
      };

      const request2: ZynlepayPaymentRequest = {
        amount: 200,
        currency: 'ZMW',
        description: 'Payment 2',
      };

      await zynlepayService.initializePayment(request1);
      await zynlepayService.initializePayment(request2);

      const stats = zynlepayService.getStatistics();

      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.totalAmount).toBeGreaterThanOrEqual(300);
      expect(stats.pending).toBeGreaterThanOrEqual(2);
    });

    it('should calculate success rate', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 180,
        currency: 'ZMW',
        description: 'Test payment',
      };

      const response = await zynlepayService.initializePayment(request);

      const webhookPayload = {
        event: 'payment.completed',
        transactionId: response.transactionId,
        status: 'completed' as const,
        amount: 180,
        currency: 'ZMW',
        timestamp: Date.now(),
      };

      zynlepayService.handleWebhook(webhookPayload);

      const stats = zynlepayService.getStatistics();
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(100);
    });

    it('should calculate average amount', async () => {
      const request1: ZynlepayPaymentRequest = {
        amount: 100,
        currency: 'ZMW',
        description: 'Payment 1',
      };

      const request2: ZynlepayPaymentRequest = {
        amount: 200,
        currency: 'ZMW',
        description: 'Payment 2',
      };

      await zynlepayService.initializePayment(request1);
      await zynlepayService.initializePayment(request2);

      const stats = zynlepayService.getStatistics();
      expect(stats.averageAmount).toBeGreaterThan(0);
    });

    it('should calculate total revenue', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 500,
        currency: 'ZMW',
        description: 'Test payment',
      };

      const response = await zynlepayService.initializePayment(request);

      const webhookPayload = {
        event: 'payment.completed',
        transactionId: response.transactionId,
        status: 'completed' as const,
        amount: 500,
        currency: 'ZMW',
        timestamp: Date.now(),
      };

      zynlepayService.handleWebhook(webhookPayload);

      const revenue = zynlepayService.getTotalRevenue();
      expect(revenue).toBeGreaterThanOrEqual(500);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle subscription payment flow', async () => {
      // Customer initiates subscription payment
      const paymentRequest: ZynlepayPaymentRequest = {
        amount: 180,
        currency: 'ZMW',
        description: 'LTC FAST TRACK - Premium Subscription (Monthly)',
        phone: '+260960123456',
        email: 'john.banda@example.com',
        firstName: 'John',
        lastName: 'Banda',
        metadata: {
          subscriptionPlan: 'Premium',
          userId: 'user-001',
          requestId: 'req-001',
        },
      };

      // Initialize payment
      const response = await zynlepayService.initializePayment(paymentRequest);
      expect(response.status).toBe('pending');
      expect(response.paymentUrl).toBeTruthy();

      // Simulate customer completing payment
      const webhookPayload = {
        event: 'payment.completed',
        transactionId: response.transactionId,
        status: 'completed' as const,
        amount: 180,
        currency: 'ZMW',
        timestamp: Date.now(),
        reference: 'ZYN-REF-123456',
        metadata: paymentRequest.metadata,
      };

      // Process webhook
      const webhookProcessed = zynlepayService.handleWebhook(webhookPayload);
      expect(webhookProcessed).toBe(true);

      // Verify payment
      const verified = zynlepayService.getTransaction(response.transactionId);
      expect(verified?.status).toBe('completed');
    });

    it('should handle collector affiliation fee payment', async () => {
      const paymentRequest: ZynlepayPaymentRequest = {
        amount: 350,
        currency: 'ZMW',
        description: 'LTC FAST TRACK - Collector Affiliation Fee (Light Truck)',
        phone: '+260962345678',
        email: 'peter.chanda@example.com',
        firstName: 'Peter',
        lastName: 'Chanda',
        metadata: {
          userRole: 'collector',
          vehicleType: 'light_truck',
          userId: 'user-002',
          requestId: 'req-002',
        },
      };

      const response = await zynlepayService.initializePayment(paymentRequest);
      expect(response.amount).toBe(350);
      expect(response.status).toBe('pending');
    });

    it('should handle failed payment scenario', async () => {
      const paymentRequest: ZynlepayPaymentRequest = {
        amount: 100,
        currency: 'ZMW',
        description: 'Test payment',
      };

      const response = await zynlepayService.initializePayment(paymentRequest);

      const webhookPayload = {
        event: 'payment.failed',
        transactionId: response.transactionId,
        status: 'failed' as const,
        amount: 100,
        currency: 'ZMW',
        timestamp: Date.now(),
      };

      zynlepayService.handleWebhook(webhookPayload);

      const transaction = zynlepayService.getTransaction(response.transactionId);
      expect(transaction?.status).toBe('failed');

      const failed = zynlepayService.getFailedPayments();
      expect(failed.some(t => t.transactionId === response.transactionId)).toBe(true);
    });
  });

  describe('Payment Methods', () => {
    it('should support mobile money payments', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 180,
        currency: 'ZMW',
        description: 'Payment via Mobile Money',
        phone: '+260960123456',
        metadata: {
          paymentMethod: 'mobile_money',
          provider: 'mtn',
        },
      };

      const response = await zynlepayService.initializePayment(request);
      expect(response.transactionId).toBeTruthy();
    });

    it('should support bank transfer payments', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 500,
        currency: 'ZMW',
        description: 'Payment via Bank Transfer',
        email: 'user@example.com',
        metadata: {
          paymentMethod: 'bank_transfer',
          bank: 'zanaco',
        },
      };

      const response = await zynlepayService.initializePayment(request);
      expect(response.transactionId).toBeTruthy();
    });

    it('should support card payments', async () => {
      const request: ZynlepayPaymentRequest = {
        amount: 250,
        currency: 'ZMW',
        description: 'Payment via Card',
        email: 'user@example.com',
        metadata: {
          paymentMethod: 'card',
        },
      };

      const response = await zynlepayService.initializePayment(request);
      expect(response.transactionId).toBeTruthy();
    });
  });
});
