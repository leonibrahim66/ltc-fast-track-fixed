/**
 * Zynlepay Webhook Endpoint Handler
 * Processes payment webhooks from Zynlepay
 */

import { Router, Request, Response } from 'express';
import { paymentWebhookService, type WebhookEvent } from '../../lib/payment-webhook-service';
import { zynlepayIntegrationService } from '../../lib/zynlepay-integration';
import { paymentDashboardService, type TransactionRecord } from '../../lib/payment-dashboard-service';

const router = Router();

/**
 * Webhook signature verification middleware
 */
function verifyWebhookSignature(req: Request, res: Response, next: Function) {
  try {
    const signature = req.headers['x-zynlepay-signature'] as string;
    const timestamp = req.headers['x-zynlepay-timestamp'] as string;
    const nonce = req.headers['x-zynlepay-nonce'] as string;

    if (!signature || !timestamp || !nonce) {
      return res.status(401).json({ error: 'Missing signature headers' });
    }

    // Verify signature
    const payload = JSON.stringify(req.body);
    const isValid = paymentWebhookService.verifyWebhookSignature(payload, {
      signature,
      timestamp: parseInt(timestamp),
      nonce,
    });

    if (!isValid) {
      console.error('[WEBHOOK] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  } catch (error) {
    console.error('[WEBHOOK] Signature verification error:', error);
    res.status(500).json({ error: 'Signature verification failed' });
  }
}

/**
 * POST /webhooks/zynlepay
 * Handle Zynlepay payment webhooks
 */
router.post('/', verifyWebhookSignature, async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;

    console.log('[WEBHOOK] Received:', {
      event: webhookData.event,
      transactionId: webhookData.transactionId,
      status: webhookData.status,
      amount: webhookData.amount,
    });

    // Create webhook event
    const webhookEvent: WebhookEvent = {
      id: `webhook-${Date.now()}`,
      event: webhookData.event || 'payment.completed',
      transactionId: webhookData.transactionId,
      status: webhookData.status,
      amount: webhookData.amount,
      currency: webhookData.currency || 'ZMW',
      timestamp: webhookData.timestamp || Date.now(),
      reference: webhookData.reference,
      metadata: webhookData.metadata,
    };

    // Process webhook through notification service
    const processed = await paymentWebhookService.processWebhookEvent(webhookEvent);

    if (!processed) {
      console.error('[WEBHOOK] Failed to process webhook');
      return res.status(500).json({ error: 'Webhook processing failed' });
    }

    // Create transaction record for dashboard
    const transaction: TransactionRecord = {
      id: `trans-${Date.now()}`,
      transactionId: webhookEvent.transactionId,
      requestId: webhookEvent.metadata?.requestId || 'unknown',
      userId: webhookEvent.metadata?.userId || 'unknown',
      userName: webhookEvent.metadata?.userName || 'Unknown User',
      amount: webhookEvent.amount,
      status: webhookEvent.status,
      paymentMethod: webhookEvent.metadata?.paymentMethod || 'unknown',
      timestamp: webhookEvent.timestamp,
      reference: webhookEvent.reference,
    };

    paymentDashboardService.addTransaction(transaction);

    console.log('[WEBHOOK] Successfully processed:', {
      transactionId: webhookEvent.transactionId,
      status: webhookEvent.status,
    });

    // Send notifications
    const notifications = paymentWebhookService.getNotifications();
    const latestNotification = notifications[notifications.length - 1];

    if (latestNotification && webhookEvent.metadata?.userEmail) {
      // Send email notification
      await paymentWebhookService.sendEmailNotification(
        webhookEvent.metadata.userEmail,
        latestNotification
      );
    }

    if (latestNotification && webhookEvent.metadata?.userPhone) {
      // Send SMS notification
      await paymentWebhookService.sendSmsNotification(
        webhookEvent.metadata.userPhone,
        latestNotification
      );
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      transactionId: webhookEvent.transactionId,
    });
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    res.status(500).json({
      error: 'Webhook processing error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /webhooks/zynlepay/test
 * Test webhook endpoint
 */
router.get('/test', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Zynlepay webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /webhooks/zynlepay/status
 * Get webhook statistics
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const webhookStats = paymentWebhookService.getWebhookStatistics();
    const notificationStats = paymentWebhookService.getNotificationStatistics();
    const dashboardMetrics = paymentDashboardService.getDashboardMetrics();

    res.status(200).json({
      webhooks: webhookStats,
      notifications: notificationStats,
      dashboard: dashboardMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get webhook status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /webhooks/zynlepay/events
 * Get recent webhook events
 */
router.get('/events', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = paymentWebhookService.getWebhookEvents().slice(-limit);

    res.status(200).json({
      count: events.length,
      events,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get webhook events',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /webhooks/zynlepay/test-event
 * Send test webhook event (for testing)
 */
router.post('/test-event', async (req: Request, res: Response) => {
  try {
    const testEvent: WebhookEvent = {
      id: `test-${Date.now()}`,
      event: 'payment.completed',
      transactionId: `TEST-${Date.now()}`,
      status: 'completed',
      amount: 180,
      currency: 'ZMW',
      timestamp: Date.now(),
      reference: `TEST-REF-${Date.now()}`,
      metadata: {
        requestId: 'test-req-001',
        userId: 'test-user-001',
        userName: 'Test User',
        userEmail: 'test@example.com',
        userPhone: '+260960000000',
      },
    };

    const processed = await paymentWebhookService.processWebhookEvent(testEvent);

    if (!processed) {
      return res.status(500).json({ error: 'Test event processing failed' });
    }

    res.status(200).json({
      success: true,
      message: 'Test event processed successfully',
      event: testEvent,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Test event processing error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
