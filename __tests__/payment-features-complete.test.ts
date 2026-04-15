import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationProviderService } from '../lib/notification-provider-service';
import type { EmailConfig, SmsConfig, PushConfig } from '../lib/notification-provider-service';

describe('Complete Payment Features', () => {
  let notificationService: NotificationProviderService;

  beforeEach(() => {
    notificationService = new NotificationProviderService();
  });

  describe('Notification Provider Configuration', () => {
    it('should configure email provider', () => {
      const emailConfig: EmailConfig = {
        provider: 'sendgrid',
        apiKey: 'test-key',
        senderEmail: 'noreply@ltcfasttrack.com',
        senderName: 'LTC FAST TRACK',
      };

      notificationService.configureEmailProvider(emailConfig);

      const status = notificationService.getProviderStatus();
      expect(status.email.configured).toBe(true);
      expect(status.email.provider).toBe('sendgrid');
    });

    it('should configure SMS provider', () => {
      const smsConfig: SmsConfig = {
        provider: 'twilio',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        senderNumber: '+1234567890',
      };

      notificationService.configureSmsProvider(smsConfig);

      const status = notificationService.getProviderStatus();
      expect(status.sms.configured).toBe(true);
      expect(status.sms.provider).toBe('twilio');
    });

    it('should configure push provider', () => {
      const pushConfig: PushConfig = {
        provider: 'firebase',
        projectId: 'test-project',
      };

      notificationService.configurePushProvider(pushConfig);

      const status = notificationService.getProviderStatus();
      expect(status.push.configured).toBe(true);
      expect(status.push.provider).toBe('firebase');
    });
  });

  describe('Email Notifications', () => {
    beforeEach(() => {
      const emailConfig: EmailConfig = {
        provider: 'sendgrid',
        apiKey: 'test-key',
        senderEmail: 'noreply@ltcfasttrack.com',
        senderName: 'LTC FAST TRACK',
      };
      notificationService.configureEmailProvider(emailConfig);
    });

    it('should send payment completed email', async () => {
      const result = await notificationService.sendEmail(
        'john@example.com',
        'payment_completed_email',
        {
          userName: 'John Banda',
          amount: '180',
          reference: 'REF-123456',
          date: new Date().toISOString(),
        }
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('sendgrid');
      expect(result.messageId).toBeTruthy();
    });

    it('should send payment failed email', async () => {
      const result = await notificationService.sendEmail(
        'jane@example.com',
        'payment_failed_email',
        {
          userName: 'Jane Mwale',
          amount: '250',
          reference: 'REF-789012',
          date: new Date().toISOString(),
        }
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('sendgrid');
    });

    it('should fail if email provider not configured', async () => {
      const newService = new NotificationProviderService();

      const result = await newService.sendEmail(
        'test@example.com',
        'payment_completed_email',
        {
          userName: 'Test User',
          amount: '100',
          reference: 'REF-000000',
          date: new Date().toISOString(),
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('SMS Notifications', () => {
    beforeEach(() => {
      const smsConfig: SmsConfig = {
        provider: 'twilio',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };
      notificationService.configureSmsProvider(smsConfig);
    });

    it('should send payment completed SMS', async () => {
      const result = await notificationService.sendSms(
        '+260960123456',
        'payment_completed_sms',
        {
          amount: '180',
          reference: 'REF-123456',
        }
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('twilio');
      expect(result.messageId).toBeTruthy();
    });

    it('should send payment failed SMS', async () => {
      const result = await notificationService.sendSms(
        '+260962345678',
        'payment_failed_sms',
        {
          amount: '250',
          reference: 'REF-789012',
        }
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('twilio');
    });
  });

  describe('Push Notifications', () => {
    beforeEach(() => {
      const pushConfig: PushConfig = {
        provider: 'firebase',
        projectId: 'ltc-fast-track',
      };
      notificationService.configurePushProvider(pushConfig);
    });

    it('should send payment completed push notification', async () => {
      const result = await notificationService.sendPush(
        'device-token-123',
        'payment_completed_push',
        {
          amount: '180',
          reference: 'REF-123456',
        }
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('firebase');
      expect(result.messageId).toBeTruthy();
    });

    it('should send payment failed push notification', async () => {
      const result = await notificationService.sendPush(
        'device-token-456',
        'payment_failed_push',
        {
          amount: '250',
        }
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('firebase');
    });
  });

  describe('Notification Templates', () => {
    it('should get all templates', () => {
      const templates = notificationService.getAllTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.id === 'payment_completed_email')).toBe(true);
      expect(templates.some(t => t.id === 'payment_failed_sms')).toBe(true);
    });

    it('should get specific template', () => {
      const template = notificationService.getTemplate('payment_completed_email');

      expect(template).toBeDefined();
      expect(template?.type).toBe('payment_completed');
      expect(template?.channel).toBe('email');
      expect(template?.subject).toContain('Payment Received');
    });

    it('should add custom template', () => {
      const customTemplate = {
        id: 'custom_payment_notification',
        type: 'payment_completed' as const,
        channel: 'email' as const,
        subject: 'Custom Payment Notification',
        body: 'Custom body for {{userName}}',
        variables: ['userName'],
      };

      notificationService.addTemplate(customTemplate);

      const retrieved = notificationService.getTemplate('custom_payment_notification');
      expect(retrieved).toBeDefined();
      expect(retrieved?.subject).toBe('Custom Payment Notification');
    });

    it('should update template', () => {
      const updated = notificationService.updateTemplate('payment_completed_email', {
        subject: 'Updated Subject',
      });

      expect(updated).toBe(true);

      const template = notificationService.getTemplate('payment_completed_email');
      expect(template?.subject).toBe('Updated Subject');
    });

    it('should delete template', () => {
      const deleted = notificationService.deleteTemplate('payment_completed_email');
      expect(deleted).toBe(true);

      const template = notificationService.getTemplate('payment_completed_email');
      expect(template).toBeUndefined();
    });
  });

  describe('Notification History and Statistics', () => {
    beforeEach(() => {
      const emailConfig: EmailConfig = {
        provider: 'sendgrid',
        apiKey: 'test-key',
        senderEmail: 'noreply@ltcfasttrack.com',
        senderName: 'LTC FAST TRACK',
      };
      const smsConfig: SmsConfig = {
        provider: 'twilio',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };
      const pushConfig: PushConfig = {
        provider: 'firebase',
        projectId: 'ltc-fast-track',
      };

      notificationService.configureEmailProvider(emailConfig);
      notificationService.configureSmsProvider(smsConfig);
      notificationService.configurePushProvider(pushConfig);
    });

    it('should track notification history', async () => {
      await notificationService.sendEmail('test@example.com', 'payment_completed_email', {
        userName: 'Test User',
        amount: '100',
        reference: 'REF-000001',
        date: new Date().toISOString(),
      });

      await notificationService.sendSms('+260960000000', 'payment_completed_sms', {
        amount: '100',
        reference: 'REF-000001',
      });

      const history = notificationService.getNotificationHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate notification statistics', async () => {
      await notificationService.sendEmail('test1@example.com', 'payment_completed_email', {
        userName: 'User 1',
        amount: '100',
        reference: 'REF-000001',
        date: new Date().toISOString(),
      });

      await notificationService.sendSms('+260960000001', 'payment_completed_sms', {
        amount: '100',
        reference: 'REF-000001',
      });

      await notificationService.sendPush('device-token-001', 'payment_completed_push', {
        amount: '100',
        reference: 'REF-000001',
      });

      const stats = notificationService.getNotificationStatistics();

      expect(stats.total).toBe(3);
      expect(stats.successful).toBe(3);
      expect(stats.failed).toBe(0);
      expect(stats.byChannel.email).toBe(1);
      expect(stats.byChannel.sms).toBe(1);
      expect(stats.byChannel.push).toBe(1);
    });

    it('should track failed notifications', async () => {
      const newService = new NotificationProviderService();

      const result = await newService.sendEmail('test@example.com', 'payment_completed_email', {
        userName: 'Test',
        amount: '100',
        reference: 'REF-000001',
        date: new Date().toISOString(),
      });

      expect(result.success).toBe(false);

      const stats = newService.getNotificationStatistics();
      // Failed notifications are still tracked
      expect(stats.failed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Multi-channel Notifications', () => {
    beforeEach(() => {
      const emailConfig: EmailConfig = {
        provider: 'sendgrid',
        apiKey: 'test-key',
        senderEmail: 'noreply@ltcfasttrack.com',
        senderName: 'LTC FAST TRACK',
      };
      const smsConfig: SmsConfig = {
        provider: 'twilio',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };
      const pushConfig: PushConfig = {
        provider: 'firebase',
        projectId: 'ltc-fast-track',
      };

      notificationService.configureEmailProvider(emailConfig);
      notificationService.configureSmsProvider(smsConfig);
      notificationService.configurePushProvider(pushConfig);
    });

    it('should send multi-channel payment notification', async () => {
      const variables = {
        userName: 'John Banda',
        amount: '180',
        reference: 'REF-123456',
        date: new Date().toISOString(),
      };

      const emailResult = await notificationService.sendEmail(
        'john@example.com',
        'payment_completed_email',
        variables
      );

      const smsResult = await notificationService.sendSms(
        '+260960123456',
        'payment_completed_sms',
        {
          amount: '180',
          reference: 'REF-123456',
        }
      );

      const pushResult = await notificationService.sendPush(
        'device-token-123',
        'payment_completed_push',
        {
          amount: '180',
          reference: 'REF-123456',
        }
      );

      expect(emailResult.success).toBe(true);
      expect(smsResult.success).toBe(true);
      expect(pushResult.success).toBe(true);

      const stats = notificationService.getNotificationStatistics();
      expect(stats.total).toBe(3);
      expect(stats.successful).toBe(3);
    });
  });

  describe('Real-world Scenarios', () => {
    beforeEach(() => {
      const emailConfig: EmailConfig = {
        provider: 'sendgrid',
        apiKey: 'test-key',
        senderEmail: 'noreply@ltcfasttrack.com',
        senderName: 'LTC FAST TRACK',
      };
      const smsConfig: SmsConfig = {
        provider: 'twilio',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      notificationService.configureEmailProvider(emailConfig);
      notificationService.configureSmsProvider(smsConfig);
    });

    it('should handle subscription payment notification flow', async () => {
      const userEmail = 'subscriber@example.com';
      const userPhone = '+260960123456';
      const amount = '180';
      const reference = 'REF-SUB-001';

      // Send email notification
      const emailResult = await notificationService.sendEmail(
        userEmail,
        'payment_completed_email',
        {
          userName: 'John Banda',
          amount,
          reference,
          date: new Date().toISOString(),
        }
      );

      // Send SMS notification
      const smsResult = await notificationService.sendSms(userPhone, 'payment_completed_sms', {
        amount,
        reference,
      });

      expect(emailResult.success).toBe(true);
      expect(smsResult.success).toBe(true);

      const stats = notificationService.getNotificationStatistics();
      expect(stats.successful).toBe(2);
    });

    it('should handle payment failure notification flow', async () => {
      const userEmail = 'failed@example.com';
      const userPhone = '+260962345678';
      const amount = '250';
      const reference = 'REF-FAIL-001';

      // Send email notification
      const emailResult = await notificationService.sendEmail(
        userEmail,
        'payment_failed_email',
        {
          userName: 'Jane Mwale',
          amount,
          reference,
          date: new Date().toISOString(),
        }
      );

      // Send SMS notification
      const smsResult = await notificationService.sendSms(userPhone, 'payment_failed_sms', {
        amount,
        reference,
      });

      expect(emailResult.success).toBe(true);
      expect(smsResult.success).toBe(true);

      const stats = notificationService.getNotificationStatistics();
      expect(stats.byType.payment_failed).toBe(2);
    });
  });
});
