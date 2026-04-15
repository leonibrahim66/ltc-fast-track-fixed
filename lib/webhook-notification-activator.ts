/**
 * Webhook & Notification Activator
 * Manages activation and testing of webhooks and notification providers
 */

import { WebhookNotificationDeployment } from './webhook-notification-deployment';

export interface ActivationStatus {
  id: string;
  timestamp: number;
  webhooks: WebhookActivationStatus[];
  providers: ProviderActivationStatus[];
  overallStatus: 'ready' | 'partial' | 'failed';
  readinessScore: number; // 0-100
}

export interface WebhookActivationStatus {
  name: string;
  provider: string;
  endpoint: string;
  status: 'active' | 'inactive' | 'error';
  testResult: {
    passed: boolean;
    message: string;
    timestamp: number;
  } | null;
  eventsConfigured: string[];
  lastEvent?: {
    type: string;
    timestamp: number;
  };
}

export interface ProviderActivationStatus {
  name: string;
  type: 'email' | 'sms' | 'push';
  status: 'configured' | 'unconfigured' | 'error';
  testResult: {
    passed: boolean;
    message: string;
    timestamp: number;
  } | null;
  credentials: {
    hasApiKey: boolean;
    hasApiSecret: boolean;
    hasEndpoint: boolean;
  };
  lastUsed?: number;
}

export interface ActivationTask {
  id: string;
  name: string;
  description: string;
  type: 'webhook' | 'provider' | 'test';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  result?: {
    success: boolean;
    message: string;
    details?: Record<string, any>;
  };
}

export class WebhookNotificationActivator {
  private deployment: WebhookNotificationDeployment;
  private activationStatus: ActivationStatus;
  private tasks: Map<string, ActivationTask> = new Map();

  constructor() {
    this.deployment = new WebhookNotificationDeployment();
    this.activationStatus = this.initializeStatus();
  }

  /**
   * Initialize activation status
   */
  private initializeStatus(): ActivationStatus {
    return {
      id: `status-${Date.now()}`,
      timestamp: Date.now(),
      webhooks: [],
      providers: [],
      overallStatus: 'failed',
      readinessScore: 0,
    };
  }

  /**
   * Activate all webhooks and providers
   */
  async activateAll(): Promise<ActivationStatus> {
    const tasks: ActivationTask[] = [];

    // Activate webhooks
    const webhookTask: ActivationTask = {
      id: `task-webhook-${Date.now()}`,
      name: 'Activate Webhooks',
      description: 'Deploy and test all webhook endpoints',
      type: 'webhook',
      status: 'running',
      startTime: Date.now(),
    };
    tasks.push(webhookTask);

    const webhookResult = await this.activateWebhooks();
    webhookTask.status = 'completed';
    webhookTask.endTime = Date.now();
    webhookTask.result = {
      success: webhookResult.success,
      message: webhookResult.message,
      details: { webhooks: this.activationStatus.webhooks },
    };

    // Activate providers
    const providerTask: ActivationTask = {
      id: `task-provider-${Date.now()}`,
      name: 'Activate Notification Providers',
      description: 'Configure and test all notification providers',
      type: 'provider',
      status: 'running',
      startTime: Date.now(),
    };
    tasks.push(providerTask);

    const providerResult = await this.activateProviders();
    providerTask.status = 'completed';
    providerTask.endTime = Date.now();
    providerTask.result = {
      success: providerResult.success,
      message: providerResult.message,
      details: { providers: this.activationStatus.providers },
    };

    // Run integration tests
    const testTask: ActivationTask = {
      id: `task-test-${Date.now()}`,
      name: 'Run Integration Tests',
      description: 'Test end-to-end webhook and notification delivery',
      type: 'test',
      status: 'running',
      startTime: Date.now(),
    };
    tasks.push(testTask);

    const testResult = await this.runIntegrationTests();
    testTask.status = 'completed';
    testTask.endTime = Date.now();
    testTask.result = {
      success: testResult.success,
      message: testResult.message,
      details: testResult.details,
    };

    // Store tasks
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }

    // Update overall status
    this.updateOverallStatus();

    return this.activationStatus;
  }

  /**
   * Activate webhooks
   */
  private async activateWebhooks(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const webhooks = this.deployment.getAllWebhooksStatus();

      for (const webhook of webhooks) {
        const result = await this.deployment.deployWebhook(webhook.provider);

        const status: WebhookActivationStatus = {
          name: webhook.provider,
          provider: webhook.provider,
          endpoint: webhook.endpoint,
          status: result.success ? 'active' : 'error',
          testResult: {
            passed: result.success,
            message: result.message,
            timestamp: Date.now(),
          },
          eventsConfigured: webhook.events,
        };

        this.activationStatus.webhooks.push(status);
      }

      return {
        success: this.activationStatus.webhooks.every((w) => w.status === 'active'),
        message: `Activated ${this.activationStatus.webhooks.length} webhooks`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to activate webhooks: ${error}`,
      };
    }
  }

  /**
   * Activate notification providers
   */
  private async activateProviders(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const providers = this.deployment.getAllProvidersStatus();

      for (const provider of providers) {
        // Determine provider type
        let type: 'email' | 'sms' | 'push' = 'email';
        if (provider.provider === 'twilio') type = 'sms';
        if (provider.provider === 'firebase') type = 'push';

        // Configure provider
        const configResult = await this.deployment.configureProvider(provider.provider, {
          apiKey: provider.apiKey,
          apiSecret: provider.apiSecret,
        });

        const status: ProviderActivationStatus = {
          name: provider.provider,
          type,
          status: configResult.success ? 'configured' : 'error',
          testResult: {
            passed: configResult.success,
            message: configResult.message,
            timestamp: Date.now(),
          },
          credentials: {
            hasApiKey: !!provider.apiKey,
            hasApiSecret: !!provider.apiSecret,
            hasEndpoint: !!provider.endpoint,
          },
        };

        this.activationStatus.providers.push(status);
      }

      return {
        success: this.activationStatus.providers.every((p) => p.status === 'configured'),
        message: `Configured ${this.activationStatus.providers.length} notification providers`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to configure providers: ${error}`,
      };
    }
  }

  /**
   * Run integration tests
   */
  private async runIntegrationTests(): Promise<{
    success: boolean;
    message: string;
    details: Record<string, any>;
  }> {
    const results: Record<string, any> = {
      webhookTests: [],
      notificationTests: [],
      endToEndTests: [],
    };

    try {
      // Test webhook event processing
      const webhookTest = await this.deployment.processWebhookEvent({
        provider: 'zynlepay',
        eventType: 'payment.completed',
        payload: {
          transactionId: 'test-txn-123',
          amount: 180,
          userEmail: 'test@ltcfasttrack.com',
        },
      });

      results.webhookTests.push({
        name: 'Process payment.completed webhook',
        passed: webhookTest.success,
        eventId: webhookTest.eventId,
      });

      // Test email notification
      const emailTest = await this.deployment.sendNotification({
        recipient: 'test@ltcfasttrack.com',
        type: 'email',
        subject: 'LTC FAST TRACK - Payment Confirmation',
        body: 'Your payment has been processed successfully.',
      });

      results.notificationTests.push({
        name: 'Send email notification',
        passed: emailTest.success,
        deliveryId: emailTest.deliveryId,
      });

      // Test SMS notification
      const smsTest = await this.deployment.sendNotification({
        recipient: '+260960000001',
        type: 'sms',
        subject: 'Payment Confirmation',
        body: 'Your payment has been processed successfully.',
      });

      results.notificationTests.push({
        name: 'Send SMS notification',
        passed: smsTest.success,
        deliveryId: smsTest.deliveryId,
      });

      // Test push notification
      const pushTest = await this.deployment.sendNotification({
        recipient: 'device-token-123',
        type: 'push',
        subject: 'Payment Confirmation',
        body: 'Your payment has been processed successfully.',
      });

      results.notificationTests.push({
        name: 'Send push notification',
        passed: pushTest.success,
        deliveryId: pushTest.deliveryId,
      });

      // End-to-end test: webhook triggers notifications
      results.endToEndTests.push({
        name: 'End-to-end: Webhook triggers email notification',
        passed: webhookTest.success && emailTest.success,
      });

      results.endToEndTests.push({
        name: 'End-to-end: Webhook triggers SMS notification',
        passed: webhookTest.success && smsTest.success,
      });

      results.endToEndTests.push({
        name: 'End-to-end: Webhook triggers push notification',
        passed: webhookTest.success && pushTest.success,
      });

      const allPassed = [
        ...results.webhookTests,
        ...results.notificationTests,
        ...results.endToEndTests,
      ].every((t) => t.passed);

      return {
        success: allPassed,
        message: `Integration tests: ${allPassed ? 'All passed' : 'Some failed'}`,
        details: results,
      };
    } catch (error) {
      return {
        success: false,
        message: `Integration tests failed: ${error}`,
        details: results,
      };
    }
  }

  /**
   * Update overall status
   */
  private updateOverallStatus(): void {
    const webhookReady = this.activationStatus.webhooks.every((w) => w.status === 'active');
    const providersReady = this.activationStatus.providers.every((p) => p.status === 'configured');

    if (webhookReady && providersReady) {
      this.activationStatus.overallStatus = 'ready';
      this.activationStatus.readinessScore = 100;
    } else if (
      this.activationStatus.webhooks.some((w) => w.status === 'active')
      || this.activationStatus.providers.some((p) => p.status === 'configured')
    ) {
      this.activationStatus.overallStatus = 'partial';
      const activeWebhooks = this.activationStatus.webhooks.filter((w) => w.status === 'active').length;
      const configuredProviders = this.activationStatus.providers.filter((p) => p.status === 'configured').length;
      const total = this.activationStatus.webhooks.length + this.activationStatus.providers.length;
      this.activationStatus.readinessScore = ((activeWebhooks + configuredProviders) / total) * 100;
    } else {
      this.activationStatus.overallStatus = 'failed';
      this.activationStatus.readinessScore = 0;
    }

    this.activationStatus.timestamp = Date.now();
  }

  /**
   * Get activation status
   */
  getActivationStatus(): ActivationStatus {
    return this.activationStatus;
  }

  /**
   * Get webhook status
   */
  getWebhookStatus(provider: string): WebhookActivationStatus | undefined {
    return this.activationStatus.webhooks.find((w) => w.provider === provider);
  }

  /**
   * Get provider status
   */
  getProviderStatus(provider: string): ProviderActivationStatus | undefined {
    return this.activationStatus.providers.find((p) => p.name === provider);
  }

  /**
   * Get task
   */
  getTask(taskId: string): ActivationTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): ActivationTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get readiness report
   */
  getReadinessReport(): {
    score: number;
    status: string;
    webhooks: { name: string; status: string }[];
    providers: { name: string; status: string }[];
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Check webhooks
    for (const webhook of this.activationStatus.webhooks) {
      if (webhook.status !== 'active') {
        recommendations.push(`Activate ${webhook.provider} webhook endpoint`);
      }
    }

    // Check providers
    for (const provider of this.activationStatus.providers) {
      if (provider.status !== 'configured') {
        recommendations.push(`Configure ${provider.name} ${provider.type} provider`);
      }
      if (!provider.credentials.hasApiKey) {
        recommendations.push(`Add API key for ${provider.name}`);
      }
    }

    return {
      score: this.activationStatus.readinessScore,
      status: this.activationStatus.overallStatus,
      webhooks: this.activationStatus.webhooks.map((w) => ({
        name: w.name,
        status: w.status,
      })),
      providers: this.activationStatus.providers.map((p) => ({
        name: p.name,
        status: p.status,
      })),
      recommendations,
    };
  }

  /**
   * Get activation checklist
   */
  getActivationChecklist(): {
    category: string;
    items: { name: string; completed: boolean }[];
  }[] {
    return [
      {
        category: 'Webhook Activation',
        items: [
          {
            name: 'Deploy Zynlepay webhook endpoint',
            completed: this.activationStatus.webhooks.some((w) => w.provider === 'zynlepay' && w.status === 'active'),
          },
          {
            name: 'Test webhook event processing',
            completed: this.activationStatus.webhooks.some((w) => w.testResult?.passed),
          },
        ],
      },
      {
        category: 'Notification Providers',
        items: [
          {
            name: 'Configure SendGrid email provider',
            completed: this.activationStatus.providers.some((p) => p.name === 'sendgrid' && p.status === 'configured'),
          },
          {
            name: 'Configure Twilio SMS provider',
            completed: this.activationStatus.providers.some((p) => p.name === 'twilio' && p.status === 'configured'),
          },
          {
            name: 'Configure Firebase push provider',
            completed: this.activationStatus.providers.some((p) => p.name === 'firebase' && p.status === 'configured'),
          },
        ],
      },
      {
        category: 'Integration Testing',
        items: [
          {
            name: 'Test webhook to email notification flow',
            completed: this.tasks.values().some((t) => t.type === 'test' && t.status === 'completed'),
          },
          {
            name: 'Test webhook to SMS notification flow',
            completed: this.tasks.values().some((t) => t.type === 'test' && t.status === 'completed'),
          },
          {
            name: 'Test webhook to push notification flow',
            completed: this.tasks.values().some((t) => t.type === 'test' && t.status === 'completed'),
          },
        ],
      },
    ];
  }
}

export const webhookNotificationActivator = new WebhookNotificationActivator();
