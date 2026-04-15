/**
 * Email Notification Service
 * Handles sending approval/rejection emails to users
 */

export interface EmailTemplate {
  subject: string;
  body: string;
  htmlBody: string;
}

export interface EmailNotification {
  id: string;
  recipientEmail: string;
  recipientName: string;
  type: 'approval' | 'rejection' | 'activation';
  requestId: string;
  timestamp: number;
  status: 'pending' | 'sent' | 'failed';
  retryCount: number;
}

export class EmailNotificationService {
  private notifications: EmailNotification[] = [];
  private templates: Map<string, EmailTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize email templates
   */
  private initializeTemplates() {
    // Approval template
    this.templates.set('approval', {
      subject: 'LTC FAST TRACK - Subscription Approved ✓',
      body: `Dear {{userName}},

Your subscription request has been approved!

Plan: {{planName}}
Amount: K{{amount}}
Reference: {{requestId}}

Your account will be activated shortly. You can now access all features of LTC FAST TRACK.

Thank you for choosing LTC FAST TRACK!

Best regards,
LTC FAST TRACK Team
+260960819993`,
      htmlBody: `
        <h2>Subscription Approved!</h2>
        <p>Dear {{userName}},</p>
        <p>Your subscription request has been <strong>approved</strong>!</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; font-weight: bold;">Plan:</td>
            <td style="padding: 8px;">{{planName}}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Amount:</td>
            <td style="padding: 8px;">K{{amount}}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Reference:</td>
            <td style="padding: 8px;">{{requestId}}</td>
          </tr>
        </table>
        <p>Your account will be activated shortly. You can now access all features of LTC FAST TRACK.</p>
        <p>Thank you for choosing LTC FAST TRACK!</p>
        <p>Best regards,<br/>LTC FAST TRACK Team<br/>+260960819993</p>
      `,
    });

    // Rejection template
    this.templates.set('rejection', {
      subject: 'LTC FAST TRACK - Subscription Request Review Needed',
      body: `Dear {{userName}},

Thank you for your subscription request. We need to review some details before we can proceed.

Reason: {{reason}}

Please contact our support team for assistance:
Phone: +260960819993
WhatsApp: +260960500656
Email: support@ltcfasttrack.com

We're here to help!

Best regards,
LTC FAST TRACK Team`,
      htmlBody: `
        <h2>Subscription Request - Review Needed</h2>
        <p>Dear {{userName}},</p>
        <p>Thank you for your subscription request. We need to review some details before we can proceed.</p>
        <div style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 12px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold;">Reason:</p>
          <p style="margin: 8px 0 0 0;">{{reason}}</p>
        </div>
        <p>Please contact our support team for assistance:</p>
        <ul>
          <li>Phone: +260960819993</li>
          <li>WhatsApp: +260960500656</li>
          <li>Email: support@ltcfasttrack.com</li>
        </ul>
        <p>We're here to help!</p>
        <p>Best regards,<br/>LTC FAST TRACK Team</p>
      `,
    });

    // Activation template
    this.templates.set('activation', {
      subject: 'LTC FAST TRACK - Account Activated! 🎉',
      body: `Dear {{userName}},

Your LTC FAST TRACK account is now active!

You can now:
- Request garbage pickups
- Track collections in real-time
- Manage your subscription
- Access all premium features

Get started: Open the LTC FAST TRACK app and login with your credentials.

Questions? Contact us:
Phone: +260960819993
WhatsApp: +260960500656

Welcome aboard!

Best regards,
LTC FAST TRACK Team`,
      htmlBody: `
        <h2>Account Activated! 🎉</h2>
        <p>Dear {{userName}},</p>
        <p>Your LTC FAST TRACK account is now <strong>active</strong>!</p>
        <p>You can now:</p>
        <ul>
          <li>Request garbage pickups</li>
          <li>Track collections in real-time</li>
          <li>Manage your subscription</li>
          <li>Access all premium features</li>
        </ul>
        <p><strong>Get started:</strong> Open the LTC FAST TRACK app and login with your credentials.</p>
        <p>Questions? Contact us:</p>
        <ul>
          <li>Phone: +260960819993</li>
          <li>WhatsApp: +260960500656</li>
        </ul>
        <p>Welcome aboard!</p>
        <p>Best regards,<br/>LTC FAST TRACK Team</p>
      `,
    });
  }

  /**
   * Send approval email
   */
  async sendApprovalEmail(
    recipientEmail: string,
    recipientName: string,
    requestId: string,
    planName: string,
    amount: number
  ): Promise<EmailNotification> {
    const template = this.templates.get('approval')!;
    const notification = this.createNotification(
      recipientEmail,
      recipientName,
      'approval',
      requestId
    );

    try {
      // Replace template variables
      const subject = template.subject;
      const body = template.body
        .replace('{{userName}}', recipientName)
        .replace('{{planName}}', planName)
        .replace('{{amount}}', amount.toString())
        .replace('{{requestId}}', requestId);

      const htmlBody = template.htmlBody
        .replace('{{userName}}', recipientName)
        .replace('{{planName}}', planName)
        .replace('{{amount}}', amount.toString())
        .replace('{{requestId}}', requestId);

      // Simulate email sending
      await this.simulateEmailSend(recipientEmail, subject, body);

      notification.status = 'sent';
      this.notifications.push(notification);
      return notification;
    } catch (error) {
      notification.status = 'failed';
      notification.retryCount++;
      this.notifications.push(notification);
      throw error;
    }
  }

  /**
   * Send rejection email
   */
  async sendRejectionEmail(
    recipientEmail: string,
    recipientName: string,
    requestId: string,
    reason: string
  ): Promise<EmailNotification> {
    const template = this.templates.get('rejection')!;
    const notification = this.createNotification(
      recipientEmail,
      recipientName,
      'rejection',
      requestId
    );

    try {
      const subject = template.subject;
      const body = template.body
        .replace('{{userName}}', recipientName)
        .replace('{{reason}}', reason);

      const htmlBody = template.htmlBody
        .replace('{{userName}}', recipientName)
        .replace('{{reason}}', reason);

      await this.simulateEmailSend(recipientEmail, subject, body);

      notification.status = 'sent';
      this.notifications.push(notification);
      return notification;
    } catch (error) {
      notification.status = 'failed';
      notification.retryCount++;
      this.notifications.push(notification);
      throw error;
    }
  }

  /**
   * Send activation email
   */
  async sendActivationEmail(
    recipientEmail: string,
    recipientName: string,
    requestId: string
  ): Promise<EmailNotification> {
    const template = this.templates.get('activation')!;
    const notification = this.createNotification(
      recipientEmail,
      recipientName,
      'activation',
      requestId
    );

    try {
      const subject = template.subject;
      const body = template.body.replace('{{userName}}', recipientName);
      const htmlBody = template.htmlBody.replace('{{userName}}', recipientName);

      await this.simulateEmailSend(recipientEmail, subject, body);

      notification.status = 'sent';
      this.notifications.push(notification);
      return notification;
    } catch (error) {
      notification.status = 'failed';
      notification.retryCount++;
      this.notifications.push(notification);
      throw error;
    }
  }

  /**
   * Get all notifications
   */
  getNotifications(): EmailNotification[] {
    return this.notifications;
  }

  /**
   * Get notifications by status
   */
  getNotificationsByStatus(status: EmailNotification['status']): EmailNotification[] {
    return this.notifications.filter(n => n.status === status);
  }

  /**
   * Get notifications by type
   */
  getNotificationsByType(type: EmailNotification['type']): EmailNotification[] {
    return this.notifications.filter(n => n.type === type);
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(): Promise<number> {
    const failed = this.getNotificationsByStatus('failed');
    let retryCount = 0;

    for (const notification of failed) {
      if (notification.retryCount < 3) {
        try {
          notification.status = 'sent';
          retryCount++;
        } catch (error) {
          notification.retryCount++;
        }
      }
    }

    return retryCount;
  }

  /**
   * Create notification object
   */
  private createNotification(
    email: string,
    name: string,
    type: EmailNotification['type'],
    requestId: string
  ): EmailNotification {
    return {
      id: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      recipientEmail: email,
      recipientName: name,
      type,
      requestId,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
    };
  }

  /**
   * Simulate email sending (in production, this would use SendGrid, AWS SES, etc.)
   */
  private async simulateEmailSend(
    email: string,
    subject: string,
    body: string
  ): Promise<void> {
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        console.log(`[EMAIL] To: ${email}`);
        console.log(`[EMAIL] Subject: ${subject}`);
        console.log(`[EMAIL] Body: ${body.substring(0, 100)}...`);
        resolve();
      }, 100);
    });
  }

  /**
   * Get email statistics
   */
  getStatistics() {
    return {
      total: this.notifications.length,
      sent: this.notifications.filter(n => n.status === 'sent').length,
      failed: this.notifications.filter(n => n.status === 'failed').length,
      pending: this.notifications.filter(n => n.status === 'pending').length,
      approvals: this.notifications.filter(n => n.type === 'approval').length,
      rejections: this.notifications.filter(n => n.type === 'rejection').length,
      activations: this.notifications.filter(n => n.type === 'activation').length,
    };
  }
}

// Create singleton instance
export const emailNotificationService = new EmailNotificationService();
