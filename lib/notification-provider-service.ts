/**
 * Notification Provider Integration Service
 * Handles email, SMS, and push notifications
 */

export interface EmailConfig {
  provider: 'sendgrid' | 'aws_ses' | 'smtp';
  apiKey?: string;
  senderEmail: string;
  senderName: string;
}

export interface SmsConfig {
  provider: 'twilio' | 'aws_sns' | 'vonage';
  apiKey?: string;
  apiSecret?: string;
  senderNumber?: string;
}

export interface PushConfig {
  provider: 'firebase' | 'onesignal' | 'expo';
  apiKey?: string;
  projectId?: string;
}

export interface NotificationTemplate {
  id: string;
  type: 'payment_completed' | 'payment_failed' | 'payment_pending';
  channel: 'email' | 'sms' | 'push';
  subject?: string;
  title?: string;
  body: string;
  variables: string[];
}

export interface NotificationResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  timestamp: number;
}

export class NotificationProviderService {
  private emailConfig: EmailConfig | null = null;
  private smsConfig: SmsConfig | null = null;
  private pushConfig: PushConfig | null = null;
  private templates: Map<string, NotificationTemplate> = new Map();
  private sentNotifications: Array<{
    recipient: string;
    type: string;
    channel: string;
    result: NotificationResult;
  }> = [];

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default notification templates
   */
  private initializeDefaultTemplates(): void {
    const templates: NotificationTemplate[] = [
      {
        id: 'payment_completed_email',
        type: 'payment_completed',
        channel: 'email',
        subject: 'LTC FAST TRACK - Payment Received ✓',
        body: `Dear {{userName}},

Your payment of K{{amount}} has been successfully received and verified.

Transaction Details:
- Reference: {{reference}}
- Amount: K{{amount}}
- Date: {{date}}
- Status: Completed

Your subscription is now active. Thank you for choosing LTC FAST TRACK!

Best regards,
LTC FAST TRACK Team`,
        variables: ['userName', 'amount', 'reference', 'date'],
      },
      {
        id: 'payment_failed_email',
        type: 'payment_failed',
        channel: 'email',
        subject: 'LTC FAST TRACK - Payment Failed',
        body: `Dear {{userName}},

Unfortunately, your payment of K{{amount}} could not be processed.

Transaction Details:
- Reference: {{reference}}
- Amount: K{{amount}}
- Date: {{date}}
- Status: Failed

Please try again or contact our support team for assistance.

Support Contact:
Email: support@ltcfasttrack.com
Phone: +260 960 819 993

Best regards,
LTC FAST TRACK Team`,
        variables: ['userName', 'amount', 'reference', 'date'],
      },
      {
        id: 'payment_completed_sms',
        type: 'payment_completed',
        channel: 'sms',
        body: 'LTC FAST TRACK: Your payment of K{{amount}} has been received. Ref: {{reference}}. Thank you!',
        variables: ['amount', 'reference'],
      },
      {
        id: 'payment_failed_sms',
        type: 'payment_failed',
        channel: 'sms',
        body: 'LTC FAST TRACK: Payment of K{{amount}} failed. Please try again. Ref: {{reference}}',
        variables: ['amount', 'reference'],
      },
      {
        id: 'payment_completed_push',
        type: 'payment_completed',
        channel: 'push',
        title: 'Payment Successful',
        body: 'Your payment of K{{amount}} has been received. Ref: {{reference}}',
        variables: ['amount', 'reference'],
      },
      {
        id: 'payment_failed_push',
        type: 'payment_failed',
        channel: 'push',
        title: 'Payment Failed',
        body: 'Your payment of K{{amount}} could not be processed. Please try again.',
        variables: ['amount'],
      },
    ];

    for (const template of templates) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Configure email provider
   */
  configureEmailProvider(config: EmailConfig): void {
    this.emailConfig = config;
    console.log(`[NOTIFICATION] Email provider configured: ${config.provider}`);
  }

  /**
   * Configure SMS provider
   */
  configureSmsProvider(config: SmsConfig): void {
    this.smsConfig = config;
    console.log(`[NOTIFICATION] SMS provider configured: ${config.provider}`);
  }

  /**
   * Configure push notification provider
   */
  configurePushProvider(config: PushConfig): void {
    this.pushConfig = config;
    console.log(`[NOTIFICATION] Push provider configured: ${config.provider}`);
  }

  /**
   * Send email notification
   */
  async sendEmail(
    recipient: string,
    templateId: string,
    variables: Record<string, string>
  ): Promise<NotificationResult> {
    try {
      if (!this.emailConfig) {
        return {
          success: false,
          provider: 'email',
          error: 'Email provider not configured',
          timestamp: Date.now(),
        };
      }

      const template = this.templates.get(templateId);
      if (!template) {
        return {
          success: false,
          provider: 'email',
          error: `Template ${templateId} not found`,
          timestamp: Date.now(),
        };
      }

      // Replace variables in template
      let subject = template.subject || '';
      let body = template.body;

      for (const [key, value] of Object.entries(variables)) {
        subject = subject.replace(`{{${key}}}`, value);
        body = body.replace(`{{${key}}}`, value);
      }

      // Send email based on provider
      const result = await this.sendEmailViaProvider(recipient, subject, body);

      this.sentNotifications.push({
        recipient,
        type: template.type,
        channel: 'email',
        result,
      });

      return result;
    } catch (error) {
      const result: NotificationResult = {
        success: false,
        provider: 'email',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };

      this.sentNotifications.push({
        recipient,
        type: 'payment_completed',
        channel: 'email',
        result,
      });

      return result;
    }
  }

  /**
   * Send SMS notification
   */
  async sendSms(
    phoneNumber: string,
    templateId: string,
    variables: Record<string, string>
  ): Promise<NotificationResult> {
    try {
      if (!this.smsConfig) {
        return {
          success: false,
          provider: 'sms',
          error: 'SMS provider not configured',
          timestamp: Date.now(),
        };
      }

      const template = this.templates.get(templateId);
      if (!template) {
        return {
          success: false,
          provider: 'sms',
          error: `Template ${templateId} not found`,
          timestamp: Date.now(),
        };
      }

      // Replace variables in template
      let body = template.body;
      for (const [key, value] of Object.entries(variables)) {
        body = body.replace(`{{${key}}}`, value);
      }

      // Send SMS based on provider
      const result = await this.sendSmsViaProvider(phoneNumber, body);

      this.sentNotifications.push({
        recipient: phoneNumber,
        type: template.type,
        channel: 'sms',
        result,
      });

      return result;
    } catch (error) {
      const result: NotificationResult = {
        success: false,
        provider: 'sms',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };

      this.sentNotifications.push({
        recipient: phoneNumber,
        type: 'payment_completed',
        channel: 'sms',
        result,
      });

      return result;
    }
  }

  /**
   * Send push notification
   */
  async sendPush(
    deviceToken: string,
    templateId: string,
    variables: Record<string, string>
  ): Promise<NotificationResult> {
    try {
      if (!this.pushConfig) {
        return {
          success: false,
          provider: 'push',
          error: 'Push provider not configured',
          timestamp: Date.now(),
        };
      }

      const template = this.templates.get(templateId);
      if (!template) {
        return {
          success: false,
          provider: 'push',
          error: `Template ${templateId} not found`,
          timestamp: Date.now(),
        };
      }

      // Replace variables in template
      let title = template.title || '';
      let body = template.body;

      for (const [key, value] of Object.entries(variables)) {
        title = title.replace(`{{${key}}}`, value);
        body = body.replace(`{{${key}}}`, value);
      }

      // Send push notification based on provider
      const result = await this.sendPushViaProvider(deviceToken, title, body);

      this.sentNotifications.push({
        recipient: deviceToken,
        type: template.type,
        channel: 'push',
        result,
      });

      return result;
    } catch (error) {
      const result: NotificationResult = {
        success: false,
        provider: 'push',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };

      this.sentNotifications.push({
        recipient: deviceToken,
        type: 'payment_completed',
        channel: 'push',
        result,
      });

      return result;
    }
  }

  /**
   * Send email via provider
   */
  private async sendEmailViaProvider(
    recipient: string,
    subject: string,
    body: string
  ): Promise<NotificationResult> {
    if (!this.emailConfig) {
      throw new Error('Email provider not configured');
    }

    // Simulate sending email
    console.log(`[EMAIL] To: ${recipient}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Body: ${body.substring(0, 100)}...`);

    // In production, integrate with actual provider:
    // - SendGrid: https://sendgrid.com/docs/API_Reference/api_v3.html
    // - AWS SES: https://docs.aws.amazon.com/ses/
    // - SMTP: Use nodemailer

    return {
      success: true,
      provider: this.emailConfig.provider,
      messageId: `email-${Date.now()}`,
      timestamp: Date.now(),
    };
  }

  /**
   * Send SMS via provider
   */
  private async sendSmsViaProvider(phoneNumber: string, body: string): Promise<NotificationResult> {
    if (!this.smsConfig) {
      throw new Error('SMS provider not configured');
    }

    // Simulate sending SMS
    console.log(`[SMS] To: ${phoneNumber}`);
    console.log(`[SMS] Body: ${body}`);

    // In production, integrate with actual provider:
    // - Twilio: https://www.twilio.com/docs/sms/api
    // - AWS SNS: https://docs.aws.amazon.com/sns/
    // - Vonage: https://developer.vonage.com/messaging/sms/overview

    return {
      success: true,
      provider: this.smsConfig.provider,
      messageId: `sms-${Date.now()}`,
      timestamp: Date.now(),
    };
  }

  /**
   * Send push notification via provider
   */
  private async sendPushViaProvider(
    deviceToken: string,
    title: string,
    body: string
  ): Promise<NotificationResult> {
    if (!this.pushConfig) {
      throw new Error('Push provider not configured');
    }

    // Simulate sending push notification
    console.log(`[PUSH] To: ${deviceToken}`);
    console.log(`[PUSH] Title: ${title}`);
    console.log(`[PUSH] Body: ${body}`);

    // In production, integrate with actual provider:
    // - Firebase: https://firebase.google.com/docs/cloud-messaging
    // - OneSignal: https://documentation.onesignal.com/
    // - Expo: https://docs.expo.dev/push-notifications/overview/

    return {
      success: true,
      provider: this.pushConfig.provider,
      messageId: `push-${Date.now()}`,
      timestamp: Date.now(),
    };
  }

  /**
   * Get notification history
   */
  getNotificationHistory(limit: number = 50) {
    return this.sentNotifications.slice(-limit);
  }

  /**
   * Get notification statistics
   */
  getNotificationStatistics() {
    const stats = {
      total: this.sentNotifications.length,
      successful: 0,
      failed: 0,
      byChannel: {
        email: 0,
        sms: 0,
        push: 0,
      },
      byType: {
        payment_completed: 0,
        payment_failed: 0,
        payment_pending: 0,
      },
    };

    for (const notification of this.sentNotifications) {
      if (notification.result.success) {
        stats.successful++;
      } else {
        stats.failed++;
      }

      stats.byChannel[notification.channel as keyof typeof stats.byChannel]++;
      stats.byType[notification.type as keyof typeof stats.byType]++;
    }

    return stats;
  }

  /**
   * Get template
   */
  getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Add custom template
   */
  addTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Update template
   */
  updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }

    this.templates.set(templateId, { ...template, ...updates });
    return true;
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * Get provider status
   */
  getProviderStatus() {
    return {
      email: this.emailConfig ? { configured: true, provider: this.emailConfig.provider } : { configured: false },
      sms: this.smsConfig ? { configured: true, provider: this.smsConfig.provider } : { configured: false },
      push: this.pushConfig ? { configured: true, provider: this.pushConfig.provider } : { configured: false },
    };
  }
}

// Create singleton instance
export const notificationProviderService = new NotificationProviderService();
