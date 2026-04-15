import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailNotificationService } from '../lib/email-notification-service';
import { PaymentVerificationService } from '../lib/payment-verification-service';
import { SubscriptionApprovalEnhanced } from '../lib/subscription-approval-enhanced';

describe('Email Notification Service', () => {
  let emailService: EmailNotificationService;

  beforeEach(() => {
    emailService = new EmailNotificationService();
  });

  describe('Email Templates', () => {
    it('should have approval template', async () => {
      const notification = await emailService.sendApprovalEmail(
        'john@example.com',
        'John Banda',
        'req-001',
        'Premium',
        180
      );

      expect(notification.type).toBe('approval');
      expect(notification.status).toBe('sent');
    });

    it('should have rejection template', async () => {
      const notification = await emailService.sendRejectionEmail(
        'jane@example.com',
        'Jane Mwale',
        'req-002',
        'Payment not verified'
      );

      expect(notification.type).toBe('rejection');
      expect(notification.status).toBe('sent');
    });

    it('should have activation template', async () => {
      const notification = await emailService.sendActivationEmail(
        'peter@example.com',
        'Peter Chanda',
        'req-003'
      );

      expect(notification.type).toBe('activation');
      expect(notification.status).toBe('sent');
    });
  });

  describe('Email Sending', () => {
    it('should send approval email with correct details', async () => {
      const notification = await emailService.sendApprovalEmail(
        'user@example.com',
        'Test User',
        'req-001',
        'Premium Plan',
        250
      );

      expect(notification.recipientEmail).toBe('user@example.com');
      expect(notification.recipientName).toBe('Test User');
      expect(notification.requestId).toBe('req-001');
    });

    it('should send rejection email with reason', async () => {
      const notification = await emailService.sendRejectionEmail(
        'user@example.com',
        'Test User',
        'req-002',
        'Duplicate account detected'
      );

      expect(notification.type).toBe('rejection');
      expect(notification.status).toBe('sent');
    });

    it('should track notification status', async () => {
      const notification = await emailService.sendApprovalEmail(
        'user@example.com',
        'Test User',
        'req-001',
        'Basic',
        100
      );

      expect(['pending', 'sent', 'failed']).toContain(notification.status);
    });
  });

  describe('Notification Management', () => {
    it('should retrieve all notifications', async () => {
      await emailService.sendApprovalEmail('user1@example.com', 'User 1', 'req-001', 'Basic', 100);
      await emailService.sendRejectionEmail('user2@example.com', 'User 2', 'req-002', 'Reason');

      const notifications = emailService.getNotifications();
      expect(notifications.length).toBe(2);
    });

    it('should filter notifications by status', async () => {
      await emailService.sendApprovalEmail('user@example.com', 'User', 'req-001', 'Basic', 100);

      const sent = emailService.getNotificationsByStatus('sent');
      expect(sent.length).toBeGreaterThan(0);
      expect(sent.every(n => n.status === 'sent')).toBe(true);
    });

    it('should filter notifications by type', async () => {
      await emailService.sendApprovalEmail('user1@example.com', 'User 1', 'req-001', 'Basic', 100);
      await emailService.sendRejectionEmail('user2@example.com', 'User 2', 'req-002', 'Reason');

      const approvals = emailService.getNotificationsByType('approval');
      expect(approvals.length).toBe(1);
      expect(approvals[0].type).toBe('approval');
    });
  });

  describe('Email Statistics', () => {
    it('should calculate email statistics', async () => {
      await emailService.sendApprovalEmail('user1@example.com', 'User 1', 'req-001', 'Basic', 100);
      await emailService.sendRejectionEmail('user2@example.com', 'User 2', 'req-002', 'Reason');
      await emailService.sendActivationEmail('user3@example.com', 'User 3', 'req-003');

      const stats = emailService.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.sent).toBeGreaterThanOrEqual(3);
      expect(stats.approvals).toBe(1);
      expect(stats.rejections).toBe(1);
      expect(stats.activations).toBe(1);
    });
  });
});

describe('Payment Verification Service', () => {
  let paymentService: PaymentVerificationService;

  beforeEach(() => {
    paymentService = new PaymentVerificationService();
  });

  describe('Payment Registration', () => {
    it('should register MTN payment', () => {
      const payment = paymentService.registerPayment(
        'req-001',
        180,
        'mtn',
        'MTN123456789',
        'screenshot-url'
      );

      expect(payment.method).toBe('mtn');
      expect(payment.amount).toBe(180);
      expect(payment.status).toBe('pending');
    });

    it('should register Airtel payment', () => {
      const payment = paymentService.registerPayment(
        'req-002',
        250,
        'airtel',
        'AIR987654321',
        'screenshot-url'
      );

      expect(payment.method).toBe('airtel');
      expect(payment.amount).toBe(250);
    });

    it('should register bank payment', () => {
      const payment = paymentService.registerPayment(
        'req-003',
        500,
        'bank',
        'BANK1234567890',
        undefined
      );

      expect(payment.method).toBe('bank');
      expect(payment.amount).toBe(500);
    });
  });

  describe('Payment Verification', () => {
    it('should verify valid MTN payment', () => {
      const payment = paymentService.registerPayment(
        'req-001',
        180,
        'mtn',
        'MTN123456789',
        'screenshot-url'
      );

      const result = paymentService.verifyPayment(payment.id, 'admin-001');
      expect(result.isVerified).toBe(true);
      expect(result.method).toBe('mtn');
    });

    it('should reject invalid payment (missing screenshot)', () => {
      const payment = paymentService.registerPayment(
        'req-002',
        250,
        'mtn',
        'MTN987654321',
        undefined
      );

      const result = paymentService.verifyPayment(payment.id, 'admin-001');
      expect(result.isVerified).toBe(false);
    });

    it('should reject payment with invalid transaction ID', () => {
      const payment = paymentService.registerPayment(
        'req-003',
        180,
        'mtn',
        'MTN12',
        'screenshot-url'
      );

      const result = paymentService.verifyPayment(payment.id, 'admin-001');
      expect(result.isVerified).toBe(false);
    });
  });

  describe('Payment Status Tracking', () => {
    it('should check if payment is verified', () => {
      const payment = paymentService.registerPayment(
        'req-001',
        180,
        'mtn',
        'MTN123456789',
        'screenshot-url'
      );

      paymentService.verifyPayment(payment.id, 'admin-001');
      const isVerified = paymentService.isPaymentVerified('req-001');
      expect(isVerified).toBe(true);
    });

    it('should get payment status', () => {
      const payment = paymentService.registerPayment(
        'req-002',
        250,
        'airtel',
        'AIR987654321',
        'screenshot-url'
      );

      const status = paymentService.getPaymentStatus('req-002');
      expect(status).toBe('pending');

      paymentService.verifyPayment(payment.id, 'admin-001');
      const verifiedStatus = paymentService.getPaymentStatus('req-002');
      expect(verifiedStatus).toBe('verified');
    });

    it('should get verified payments', () => {
      const payment1 = paymentService.registerPayment(
        'req-001',
        180,
        'mtn',
        'MTN123456789',
        'screenshot-url'
      );
      const payment2 = paymentService.registerPayment(
        'req-002',
        250,
        'airtel',
        'AIR987654321',
        'screenshot-url'
      );

      paymentService.verifyPayment(payment1.id, 'admin-001');

      const verified = paymentService.getVerifiedPayments();
      expect(verified.length).toBe(1);
      expect(verified[0].requestId).toBe('req-001');
    });
  });

  describe('Payment Statistics', () => {
    it('should calculate payment statistics', () => {
      const payment1 = paymentService.registerPayment(
        'req-001',
        180,
        'mtn',
        'MTN123456789',
        'screenshot-url'
      );
      const payment2 = paymentService.registerPayment(
        'req-002',
        250,
        'airtel',
        'AIR987654321',
        'screenshot-url'
      );

      paymentService.verifyPayment(payment1.id, 'admin-001');

      const stats = paymentService.getStatistics();
      expect(stats.total).toBe(2);
      expect(stats.verified).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.totalAmount).toBe(430);
    });

    it('should calculate verification rate', () => {
      const payment1 = paymentService.registerPayment(
        'req-001',
        180,
        'mtn',
        'MTN123456789',
        'screenshot-url'
      );
      const payment2 = paymentService.registerPayment(
        'req-002',
        250,
        'airtel',
        'AIR987654321',
        'screenshot-url'
      );

      paymentService.verifyPayment(payment1.id, 'admin-001');

      const stats = paymentService.getStatistics();
      expect(stats.verificationRate).toBe(50);
    });
  });

  describe('Auto-approval and Auto-rejection', () => {
    it('should get auto-approval candidates', () => {
      const payment = paymentService.registerPayment(
        'req-001',
        180,
        'mtn',
        'MTN123456789',
        'screenshot-url'
      );

      paymentService.verifyPayment(payment.id, 'admin-001');

      const candidates = paymentService.getAutoApprovalCandidates();
      expect(candidates).toContain('req-001');
    });

    it('should get auto-rejection candidates', () => {
      const payment = paymentService.registerPayment(
        'req-002',
        250,
        'mtn',
        'MTN12',
        'screenshot-url'
      );

      paymentService.verifyPayment(payment.id, 'admin-001');

      const candidates = paymentService.getAutoRejectionCandidates();
      expect(candidates).toContain('req-002');
    });
  });
});

describe('Subscription Approval Enhanced', () => {
  let approvalEnhanced: SubscriptionApprovalEnhanced;

  beforeEach(() => {
    approvalEnhanced = new SubscriptionApprovalEnhanced();
  });

  describe('Bulk Operations', () => {
    it('should track bulk operation history', async () => {
      const mockApprovalCallback = vi.fn();
      const mockGetDetails = vi.fn(() => ({
        userName: 'Test User',
        userEmail: 'test@example.com',
        subscriptionPlan: 'Premium',
        planPrice: 180,
      }));

      const result = await approvalEnhanced.bulkApproveSubscriptions(
        {
          requestIds: ['req-001', 'req-002'],
          adminId: 'admin-001',
          adminName: 'Admin User',
        },
        mockApprovalCallback,
        mockGetDetails
      );

      expect(result.operationType).toBe('approve');
      expect(result.totalRequests).toBe(2);
    });

    it('should calculate bulk operation statistics', async () => {
      const mockApprovalCallback = vi.fn();
      const mockGetDetails = vi.fn(() => ({
        userName: 'Test User',
        userEmail: 'test@example.com',
        subscriptionPlan: 'Premium',
        planPrice: 180,
      }));

      await approvalEnhanced.bulkApproveSubscriptions(
        {
          requestIds: ['req-001'],
          adminId: 'admin-001',
          adminName: 'Admin User',
        },
        mockApprovalCallback,
        mockGetDetails
      );

      const stats = approvalEnhanced.getBulkOperationStats();
      expect(stats.totalOperations).toBeGreaterThan(0);
      expect(stats.approvals).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Payment Integration', () => {
    it('should check payment verification status', () => {
      const paymentService = new PaymentVerificationService();
      const payment = paymentService.registerPayment(
        'req-001',
        180,
        'mtn',
        'MTN123456789',
        'screenshot-url'
      );

      paymentService.verifyPayment(payment.id, 'admin-001');

      // Note: In real implementation, this would use the same service instance
      const isVerified = paymentService.isPaymentVerified('req-001');
      expect(isVerified).toBe(true);
    });

    it('should get auto-approval candidates', () => {
      const paymentService = new PaymentVerificationService();
      const payment = paymentService.registerPayment(
        'req-001',
        180,
        'mtn',
        'MTN123456789',
        'screenshot-url'
      );

      paymentService.verifyPayment(payment.id, 'admin-001');

      const candidates = paymentService.getAutoApprovalCandidates();
      expect(candidates.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should get email statistics', async () => {
      const stats = approvalEnhanced.getEmailStatistics();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('sent');
      expect(stats).toHaveProperty('approvals');
    });

    it('should get payment statistics', () => {
      const stats = approvalEnhanced.getPaymentStatistics();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('verified');
      expect(stats).toHaveProperty('pending');
    });
  });
});
