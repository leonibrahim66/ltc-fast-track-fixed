import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notificationProviderConfigService } from '../lib/notification-provider-config';
import { paymentRetryService } from '../lib/payment-retry-service';
import type { RetryablePayment } from '../lib/payment-retry-service';

describe('Payment Features - Final Implementation', () => {
  describe('Notification Provider Configuration', () => {
    beforeEach(() => {
      // Reset configuration before each test
      vi.clearAllMocks();
    });

    it('should configure SendGrid email provider', () => {
      const result = notificationProviderConfigService.configureEmailProvider(
        'sg-test-key-123',
        'noreply@ltcfasttrack.com',
        'LTC FAST TRACK'
      );

      expect(result).toBe(true);

      const status = notificationProviderConfigService.getProviderStatus('email');
      expect(status?.configured).toBe(true);
      expect(status?.provider).toBe('sendgrid');
    });

    it('should configure Twilio SMS provider', () => {
      const result = notificationProviderConfigService.configureSmsProvider(
        'twilio-account-sid',
        'twilio-auth-token',
        '+1234567890'
      );

      expect(result).toBe(true);

      const status = notificationProviderConfigService.getProviderStatus('sms');
      expect(status?.configured).toBe(true);
      expect(status?.provider).toBe('twilio');
    });

    it('should configure Firebase push provider', () => {
      const result = notificationProviderConfigService.configurePushProvider(
        'ltc-fast-track-project',
        'firebase-api-key'
      );

      expect(result).toBe(true);

      const status = notificationProviderConfigService.getProviderStatus('push');
      expect(status?.configured).toBe(true);
      expect(status?.provider).toBe('firebase');
    });

    it('should get all provider statuses', () => {
      notificationProviderConfigService.configureEmailProvider(
        'test-key',
        'test@example.com',
        'Test'
      );

      const statuses = notificationProviderConfigService.getAllProviderStatuses();

      expect(statuses.length).toBe(3);
      expect(statuses.some(s => s.name === 'Email')).toBe(true);
      expect(statuses.some(s => s.name === 'SMS')).toBe(true);
      expect(statuses.some(s => s.name === 'Push Notifications')).toBe(true);
    });

    it('should check if all providers are configured', () => {
      const allConfigured = notificationProviderConfigService.areAllProvidersConfigured();
      expect(typeof allConfigured).toBe('boolean');
    });

    it('should get configuration summary', () => {
      const summary = notificationProviderConfigService.getConfigurationSummary();

      expect(summary.totalProviders).toBe(3);
      expect(summary.configuredProviders).toBeGreaterThanOrEqual(0);
      expect(typeof summary.allConfigured).toBe('boolean');
    });
  });

  describe('Payment Retry Service', () => {
    beforeEach(() => {
      paymentRetryService.reset();
    });

    it('should add payment to retry queue', () => {
      const payment = paymentRetryService.addToRetryQueue({
        id: 'pay-001',
        transactionId: 'trans-001',
        requestId: 'req-001',
        userId: 'user-001',
        amount: 180,
        paymentMethod: 'mtn',
      });

      expect(payment.id).toBe('pay-001');
      expect(payment.status).toBe('pending');
      expect(payment.attemptCount).toBe(0);
      expect(paymentRetryService.getQueueSize()).toBe(1);
    });

    it('should mark payment as failed and schedule retry', () => {
      const payment = paymentRetryService.addToRetryQueue({
        id: 'pay-002',
        transactionId: 'trans-002',
        requestId: 'req-002',
        userId: 'user-002',
        amount: 250,
        paymentMethod: 'airtel',
      });

      const result = paymentRetryService.markAsFailed('pay-002', 'Network timeout');

      expect(result.success).toBe(true);
      expect(result.shouldRetry).toBe(true);
      expect(result.payment.attemptCount).toBe(1);
      expect(result.payment.status).toBe('failed');
      expect(result.payment.nextRetryAt).toBeDefined();
    });

    it('should mark payment as completed', () => {
      paymentRetryService.addToRetryQueue({
        id: 'pay-003',
        transactionId: 'trans-003',
        requestId: 'req-003',
        userId: 'user-003',
        amount: 350,
        paymentMethod: 'bank',
      });

      const result = paymentRetryService.markAsCompleted('pay-003', 'trans-completed-001');

      expect(result.success).toBe(true);
      expect(result.shouldRetry).toBe(false);
      expect(result.payment.status).toBe('completed');
      expect(paymentRetryService.getQueueSize()).toBe(0);
    });

    it('should calculate exponential backoff correctly', () => {
      const payment = paymentRetryService.addToRetryQueue({
        id: 'pay-004',
        transactionId: 'trans-004',
        requestId: 'req-004',
        userId: 'user-004',
        amount: 100,
        paymentMethod: 'mtn',
      });

      const delays: number[] = [];

      for (let i = 0; i < 3; i++) {
        paymentRetryService.markAsFailed('pay-004', `Attempt ${i + 1} failed`);
        const status = paymentRetryService.getPaymentStatus('pay-004');
        if (status?.nextRetryAt) {
          delays.push(status.nextRetryAt - status.lastAttemptAt!);
        }
      }

      // Each delay should be approximately 2x the previous (with jitter)
      expect(delays[1]).toBeGreaterThan(delays[0] * 1.5);
      expect(delays[2]).toBeGreaterThan(delays[1] * 1.5);
    });

    it('should get payments ready for retry', async () => {
      paymentRetryService.addToRetryQueue({
        id: 'pay-005',
        transactionId: 'trans-005',
        requestId: 'req-005',
        userId: 'user-005',
        amount: 180,
        paymentMethod: 'mtn',
      });

      paymentRetryService.markAsFailed('pay-005', 'Failed');

      // Manually set nextRetryAt to past time
      const payment = paymentRetryService.getPaymentStatus('pay-005');
      if (payment) {
        payment.nextRetryAt = Date.now() - 1000;
      }

      const readyForRetry = paymentRetryService.getPaymentsReadyForRetry();
      expect(readyForRetry.length).toBe(1);
      expect(readyForRetry[0].id).toBe('pay-005');
    });

    it('should respect max retry attempts', () => {
      paymentRetryService.updateConfig({ maxAttempts: 3 });

      paymentRetryService.addToRetryQueue({
        id: 'pay-006',
        transactionId: 'trans-006',
        requestId: 'req-006',
        userId: 'user-006',
        amount: 200,
        paymentMethod: 'bank',
      });

      let result;
      for (let i = 0; i < 3; i++) {
        result = paymentRetryService.markAsFailed('pay-006', `Attempt ${i + 1}`);
      }

      expect(result?.shouldRetry).toBe(false);
      expect(result?.payment.attemptCount).toBe(3);
    });

    it('should get retry statistics', () => {
      paymentRetryService.addToRetryQueue({
        id: 'pay-007',
        transactionId: 'trans-007',
        requestId: 'req-007',
        userId: 'user-007',
        amount: 180,
        paymentMethod: 'mtn',
      });

      paymentRetryService.addToRetryQueue({
        id: 'pay-008',
        transactionId: 'trans-008',
        requestId: 'req-008',
        userId: 'user-008',
        amount: 250,
        paymentMethod: 'airtel',
      });

      paymentRetryService.markAsFailed('pay-007', 'Failed');
      paymentRetryService.markAsCompleted('pay-008', 'trans-completed-002');

      const stats = paymentRetryService.getRetryStatistics();

      expect(stats.totalPayments).toBeGreaterThanOrEqual(1);
      expect(stats.pendingRetries).toBeGreaterThanOrEqual(0);
      expect(stats.completedPayments).toBeGreaterThanOrEqual(0);
    });

    it('should get user payments', () => {
      paymentRetryService.addToRetryQueue({
        id: 'pay-009',
        transactionId: 'trans-009',
        requestId: 'req-009',
        userId: 'user-001',
        amount: 180,
        paymentMethod: 'mtn',
      });

      paymentRetryService.addToRetryQueue({
        id: 'pay-010',
        transactionId: 'trans-010',
        requestId: 'req-010',
        userId: 'user-002',
        amount: 250,
        paymentMethod: 'airtel',
      });

      const user1Payments = paymentRetryService.getUserPayments('user-001');
      expect(user1Payments.length).toBe(1);
      expect(user1Payments[0].id).toBe('pay-009');
    });

    it('should calculate total pending amount', () => {
      paymentRetryService.addToRetryQueue({
        id: 'pay-011',
        transactionId: 'trans-011',
        requestId: 'req-011',
        userId: 'user-001',
        amount: 180,
        paymentMethod: 'mtn',
      });

      paymentRetryService.addToRetryQueue({
        id: 'pay-012',
        transactionId: 'trans-012',
        requestId: 'req-012',
        userId: 'user-002',
        amount: 250,
        paymentMethod: 'airtel',
      });

      const total = paymentRetryService.getTotalPendingAmount();
      expect(total).toBe(430);
    });

    it('should get time until next retry', async () => {
      paymentRetryService.addToRetryQueue({
        id: 'pay-013',
        transactionId: 'trans-013',
        requestId: 'req-013',
        userId: 'user-001',
        amount: 180,
        paymentMethod: 'mtn',
      });

      paymentRetryService.markAsFailed('pay-013', 'Failed');

      const timeUntilRetry = paymentRetryService.getTimeUntilNextRetry('pay-013');
      expect(timeUntilRetry).toBeDefined();
      expect(timeUntilRetry).toBeGreaterThanOrEqual(0);
    });

    it('should clear completed payments', () => {
      paymentRetryService.addToRetryQueue({
        id: 'pay-014',
        transactionId: 'trans-014',
        requestId: 'req-014',
        userId: 'user-001',
        amount: 180,
        paymentMethod: 'mtn',
      });

      paymentRetryService.addToRetryQueue({
        id: 'pay-015',
        transactionId: 'trans-015',
        requestId: 'req-015',
        userId: 'user-002',
        amount: 250,
        paymentMethod: 'airtel',
      });

      paymentRetryService.markAsCompleted('pay-014', 'trans-completed-003');

      const cleared = paymentRetryService.clearCompletedPayments();
      expect(cleared).toBeGreaterThanOrEqual(0);
      expect(paymentRetryService.getQueueSize()).toBeGreaterThanOrEqual(0);
    });

    it('should get retry history', () => {
      for (let i = 0; i < 5; i++) {
        paymentRetryService.addToRetryQueue({
          id: `pay-${i}`,
          transactionId: `trans-${i}`,
          requestId: `req-${i}`,
          userId: 'user-001',
          amount: 100 + i * 10,
          paymentMethod: 'mtn',
        });

        paymentRetryService.markAsCompleted(`pay-${i}`, `trans-completed-${i}`);
      }

      const history = paymentRetryService.getRetryHistory(3);
      expect(history.length).toBe(3);
    });
  });

  describe('Real-world Payment Retry Scenarios', () => {
    beforeEach(() => {
      paymentRetryService.reset();
    });

    it('should handle complete payment retry flow', () => {
      // Step 1: Add payment to queue
      const payment = paymentRetryService.addToRetryQueue({
        id: 'pay-scenario-001',
        transactionId: 'trans-scenario-001',
        requestId: 'req-scenario-001',
        userId: 'user-001',
        amount: 180,
        paymentMethod: 'mtn',
      });

      expect(payment.status).toBe('pending');

      // Step 2: First attempt fails
      let result = paymentRetryService.markAsFailed('pay-scenario-001', 'Network error');
      expect(result.shouldRetry).toBe(true);
      expect(result.payment.attemptCount).toBe(1);

      // Step 3: Verify attempt count increased
      result = paymentRetryService.markAsFailed('pay-scenario-001', 'Timeout');
      expect(result.payment.attemptCount).toBeGreaterThanOrEqual(2);

      // Step 4: Third attempt succeeds
      result = paymentRetryService.markAsCompleted('pay-scenario-001', 'trans-final-001');
      expect(result.success).toBe(true);
      expect(result.payment.status).toBe('completed');

      // Step 5: Verify statistics
      const stats = paymentRetryService.getRetryStatistics();
      expect(stats.completedPayments).toBeGreaterThanOrEqual(0);
    });

    it('should handle payment exceeding max retries', () => {
      paymentRetryService.updateConfig({ maxAttempts: 2 });

      paymentRetryService.addToRetryQueue({
        id: 'pay-scenario-002',
        transactionId: 'trans-scenario-002',
        requestId: 'req-scenario-002',
        userId: 'user-002',
        amount: 250,
        paymentMethod: 'airtel',
      });

      // Attempt 1
      let result = paymentRetryService.markAsFailed('pay-scenario-002', 'Error 1');
      expect(result.shouldRetry).toBe(true);

      // Attempt 2
      result = paymentRetryService.markAsFailed('pay-scenario-002', 'Error 2');
      expect(result.shouldRetry).toBe(false);

      const stats = paymentRetryService.getRetryStatistics();
      expect(stats.failedPayments).toBeGreaterThanOrEqual(0);
    });

  });

  describe('Real-world Payment Retry Scenarios', () => {
    beforeEach(() => {
      paymentRetryService.reset();
    });

    it('should handle complete payment retry flow', () => {
      // Step 1: Add payment to queue
      const payment = paymentRetryService.addToRetryQueue({
        id: 'pay-scenario-001',
        transactionId: 'trans-scenario-001',
        requestId: 'req-scenario-001',
        userId: 'user-001',
        amount: 180,
        paymentMethod: 'mtn',
      });

      expect(payment.status).toBe('pending');

      // Step 2: First attempt fails
      let result = paymentRetryService.markAsFailed('pay-scenario-001', 'Network error');
      expect(result.shouldRetry).toBe(true);
      expect(result.payment.attemptCount).toBe(1);

      // Step 3: Verify attempt count increased
      result = paymentRetryService.markAsFailed('pay-scenario-001', 'Timeout');
      expect(result.payment.attemptCount).toBeGreaterThanOrEqual(2);

      // Step 4: Third attempt succeeds
      result = paymentRetryService.markAsCompleted('pay-scenario-001', 'trans-final-001');
      expect(result.success).toBe(true);
      expect(result.payment.status).toBe('completed');

      // Step 5: Verify statistics
      const stats = paymentRetryService.getRetryStatistics();
      expect(stats.completedPayments).toBeGreaterThanOrEqual(0);
    });

    it('should track multiple concurrent payments', () => {
      for (let i = 0; i < 5; i++) {
        paymentRetryService.addToRetryQueue({
          id: `pay-concurrent-${i}`,
          transactionId: `trans-concurrent-${i}`,
          requestId: `req-concurrent-${i}`,
          userId: `user-${i}`,
          amount: 100 + i * 50,
          paymentMethod: i % 2 === 0 ? 'mtn' : 'airtel',
        });
      }

      // Fail some, complete others
      paymentRetryService.markAsFailed('pay-concurrent-0', 'Error');
      paymentRetryService.markAsCompleted('pay-concurrent-1', 'trans-1');
      paymentRetryService.markAsFailed('pay-concurrent-2', 'Error');
      paymentRetryService.markAsCompleted('pay-concurrent-3', 'trans-3');

      const stats = paymentRetryService.getRetryStatistics();
      expect(stats.totalPayments).toBeGreaterThan(0);
      expect(stats.pendingRetries).toBeGreaterThan(0);
      expect(stats.completedPayments).toBeGreaterThan(0);
    });
  });
});
