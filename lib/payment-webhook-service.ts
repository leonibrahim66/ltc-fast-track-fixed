/**
 * Payment Webhook Service
 * Handles webhook notifications from Zynlepay and triggers app notifications
 */

export interface WebhookEvent {
  id: string;
  event: string;
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  timestamp: number;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface PaymentNotification {
  id: string;
  type: 'payment_completed' | 'payment_failed' | 'payment_pending';
  title: string;
  message: string;
  transactionId: string;
  amount: number;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

export interface WebhookSignature {
  signature: string;
  timestamp: number;
  nonce: string;
}

export class PaymentWebhookService {
  private webhookEvents: WebhookEvent[] = [];
  private notifications: PaymentNotification[] = [];
  private webhookSecret: string;
  private notificationHandlers: Map<string, (event: WebhookEvent) => void> = new Map();

  constructor(webhookSecret?: string) {
    this.webhookSecret = webhookSecret || process.env.ZYNLEPAY_WEBHOOK_SECRET || 'default-secret';
    this.registerDefaultHandlers();
  }

  /**
   * Register default notification handlers
   */
  private registerDefaultHandlers(): void {
    this.registerHandler('payment.completed', this.handlePaymentCompleted.bind(this));
    this.registerHandler('payment.failed', this.handlePaymentFailed.bind(this));
    this.registerHandler('payment.pending', this.handlePaymentPending.bind(this));
  }

  /**
   * Register custom webhook handler
   */
  registerHandler(eventType: string, handler: (event: WebhookEvent) => void): void {
    this.notificationHandlers.set(eventType, handler);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: WebhookSignature): boolean {
    try {
      // In production, use HMAC-SHA256
      // For now, simple verification
      const expectedSignature = this.createSignature(payload, signature.timestamp);
      return expectedSignature === signature.signature;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Create webhook signature
   */
  private createSignature(payload: string, timestamp: number): string {
    const data = `${payload}${timestamp}${this.webhookSecret}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: WebhookEvent): Promise<boolean> {
    try {
      // Store webhook event
      this.webhookEvents.push(event);

      // Get handler for this event type
      const handler = this.notificationHandlers.get(event.event);
      if (handler) {
        handler(event);
      }

      return true;
    } catch (error) {
      console.error('Webhook processing error:', error);
      return false;
    }
  }

  /**
   * Handle payment completed event
   */
  private handlePaymentCompleted(event: WebhookEvent): void {
    const notification: PaymentNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'payment_completed',
      title: 'Payment Successful',
      message: `Your payment of K${event.amount} has been received and verified.`,
      transactionId: event.transactionId,
      amount: event.amount,
      timestamp: Date.now(),
      read: false,
      actionUrl: `/payment-receipt/${event.transactionId}`,
    };

    this.notifications.push(notification);
    this.triggerNotification(notification);
  }

  /**
   * Handle payment failed event
   */
  private handlePaymentFailed(event: WebhookEvent): void {
    const notification: PaymentNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'payment_failed',
      title: 'Payment Failed',
      message: `Your payment of K${event.amount} could not be processed. Please try again.`,
      transactionId: event.transactionId,
      amount: event.amount,
      timestamp: Date.now(),
      read: false,
      actionUrl: `/payment-retry/${event.transactionId}`,
    };

    this.notifications.push(notification);
    this.triggerNotification(notification);
  }

  /**
   * Handle payment pending event
   */
  private handlePaymentPending(event: WebhookEvent): void {
    const notification: PaymentNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'payment_pending',
      title: 'Payment Processing',
      message: `Your payment of K${event.amount} is being processed. We'll notify you when it's confirmed.`,
      transactionId: event.transactionId,
      amount: event.amount,
      timestamp: Date.now(),
      read: false,
      actionUrl: `/payment-status/${event.transactionId}`,
    };

    this.notifications.push(notification);
    this.triggerNotification(notification);
  }

  /**
   * Trigger notification (in production, send to user)
   */
  private triggerNotification(notification: PaymentNotification): void {
    // In production, this would:
    // - Send push notification
    // - Send email
    // - Update in-app notification center
    console.log('[NOTIFICATION]', notification.title, '-', notification.message);
  }

  /**
   * Get all notifications
   */
  getNotifications(): PaymentNotification[] {
    return this.notifications;
  }

  /**
   * Get unread notifications
   */
  getUnreadNotifications(): PaymentNotification[] {
    return this.notifications.filter(n => !n.read);
  }

  /**
   * Mark notification as read
   */
  markNotificationAsRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Get notifications by type
   */
  getNotificationsByType(type: PaymentNotification['type']): PaymentNotification[] {
    return this.notifications.filter(n => n.type === type);
  }

  /**
   * Get webhook events
   */
  getWebhookEvents(): WebhookEvent[] {
    return this.webhookEvents;
  }

  /**
   * Get webhook events by status
   */
  getWebhookEventsByStatus(status: string): WebhookEvent[] {
    return this.webhookEvents.filter(e => e.status === status);
  }

  /**
   * Get webhook events by transaction ID
   */
  getWebhookEventsByTransactionId(transactionId: string): WebhookEvent[] {
    return this.webhookEvents.filter(e => e.transactionId === transactionId);
  }

  /**
   * Get notification statistics
   */
  getNotificationStatistics() {
    return {
      total: this.notifications.length,
      unread: this.getUnreadNotifications().length,
      completed: this.getNotificationsByType('payment_completed').length,
      failed: this.getNotificationsByType('payment_failed').length,
      pending: this.getNotificationsByType('payment_pending').length,
    };
  }

  /**
   * Get webhook statistics
   */
  getWebhookStatistics() {
    return {
      total: this.webhookEvents.length,
      completed: this.getWebhookEventsByStatus('completed').length,
      failed: this.getWebhookEventsByStatus('failed').length,
      pending: this.getWebhookEventsByStatus('pending').length,
    };
  }

  /**
   * Clear old notifications (older than 30 days)
   */
  clearOldNotifications(daysOld: number = 30): number {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const initialLength = this.notifications.length;

    this.notifications = this.notifications.filter(n => n.timestamp > cutoffTime);

    return initialLength - this.notifications.length;
  }

  /**
   * Export notification history
   */
  exportNotificationHistory(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          notifications: this.notifications,
          webhookEvents: this.webhookEvents,
        },
        null,
        2
      );
    }

    // CSV format
    let csv = 'Notification ID,Type,Title,Transaction ID,Amount,Timestamp,Read\n';
    for (const notif of this.notifications) {
      csv += `${notif.id},${notif.type},${notif.title},${notif.transactionId},${notif.amount},${new Date(notif.timestamp).toISOString()},${notif.read}\n`;
    }
    return csv;
  }

  /**
   * Send email notification (in production)
   */
  async sendEmailNotification(
    email: string,
    notification: PaymentNotification
  ): Promise<boolean> {
    try {
      // In production, use email service (SendGrid, AWS SES, etc.)
      console.log(`[EMAIL] Sending to ${email}: ${notification.title}`);
      return true;
    } catch (error) {
      console.error('Email notification error:', error);
      return false;
    }
  }

  /**
   * Send SMS notification (in production)
   */
  async sendSmsNotification(phone: string, notification: PaymentNotification): Promise<boolean> {
    try {
      // In production, use SMS service (Twilio, AWS SNS, etc.)
      console.log(`[SMS] Sending to ${phone}: ${notification.message}`);
      return true;
    } catch (error) {
      console.error('SMS notification error:', error);
      return false;
    }
  }

  /**
   * Send push notification (in production)
   */
  async sendPushNotification(
    deviceToken: string,
    notification: PaymentNotification
  ): Promise<boolean> {
    try {
      // In production, use push notification service (Firebase, OneSignal, etc.)
      console.log(`[PUSH] Sending to ${deviceToken}: ${notification.title}`);
      return true;
    } catch (error) {
      console.error('Push notification error:', error);
      return false;
    }
  }
}

// Create singleton instance
export const paymentWebhookService = new PaymentWebhookService();
