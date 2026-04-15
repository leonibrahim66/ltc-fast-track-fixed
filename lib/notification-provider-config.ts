/**
 * Notification Provider Configuration Service
 * Manages provider setup and configuration
 */

import { notificationProviderService } from './notification-provider-service';
import type { EmailConfig, SmsConfig, PushConfig } from './notification-provider-service';

export interface ProviderStatus {
  name: string;
  provider: string;
  configured: boolean;
  lastTested?: number;
  testResult?: 'success' | 'failed';
  errorMessage?: string;
}

export interface ProviderHealthCheck {
  email: ProviderStatus;
  sms: ProviderStatus;
  push: ProviderStatus;
  timestamp: number;
}

export class NotificationProviderConfigService {
  private providerStatuses: Map<string, ProviderStatus> = new Map();

  constructor() {
    this.initializeStatuses();
  }

  /**
   * Initialize provider statuses
   */
  private initializeStatuses(): void {
    this.providerStatuses.set('email', {
      name: 'Email',
      provider: 'sendgrid',
      configured: false,
    });

    this.providerStatuses.set('sms', {
      name: 'SMS',
      provider: 'twilio',
      configured: false,
    });

    this.providerStatuses.set('push', {
      name: 'Push Notifications',
      provider: 'firebase',
      configured: false,
    });
  }

  /**
   * Configure SendGrid email provider
   */
  configureEmailProvider(apiKey: string, senderEmail: string, senderName: string): boolean {
    try {
      const config: EmailConfig = {
        provider: 'sendgrid',
        apiKey,
        senderEmail,
        senderName,
      };

      notificationProviderService.configureEmailProvider(config);

      const status = this.providerStatuses.get('email');
      if (status) {
        status.configured = true;
        status.provider = 'sendgrid';
      }

      console.log('[CONFIG] SendGrid email provider configured');
      return true;
    } catch (error) {
      console.error('[CONFIG] Failed to configure email provider:', error);
      return false;
    }
  }

  /**
   * Configure Twilio SMS provider
   */
  configureSmsProvider(apiKey: string, apiSecret: string, senderNumber: string): boolean {
    try {
      const config: SmsConfig = {
        provider: 'twilio',
        apiKey,
        apiSecret,
        senderNumber,
      };

      notificationProviderService.configureSmsProvider(config);

      const status = this.providerStatuses.get('sms');
      if (status) {
        status.configured = true;
        status.provider = 'twilio';
      }

      console.log('[CONFIG] Twilio SMS provider configured');
      return true;
    } catch (error) {
      console.error('[CONFIG] Failed to configure SMS provider:', error);
      return false;
    }
  }

  /**
   * Configure Firebase push provider
   */
  configurePushProvider(projectId: string, apiKey?: string): boolean {
    try {
      const config: PushConfig = {
        provider: 'firebase',
        projectId,
        apiKey,
      };

      notificationProviderService.configurePushProvider(config);

      const status = this.providerStatuses.get('push');
      if (status) {
        status.configured = true;
        status.provider = 'firebase';
      }

      console.log('[CONFIG] Firebase push provider configured');
      return true;
    } catch (error) {
      console.error('[CONFIG] Failed to configure push provider:', error);
      return false;
    }
  }

  /**
   * Test email provider
   */
  async testEmailProvider(testEmail: string): Promise<ProviderStatus> {
    const status = this.providerStatuses.get('email');
    if (!status) {
      throw new Error('Email provider status not found');
    }

    try {
      const result = await notificationProviderService.sendEmail(
        testEmail,
        'payment_completed_email',
        {
          userName: 'Test User',
          amount: '100',
          reference: 'TEST-REF-001',
          date: new Date().toISOString(),
        }
      );

      status.lastTested = Date.now();
      status.testResult = result.success ? 'success' : 'failed';
      if (!result.success) {
        status.errorMessage = result.error;
      }

      console.log('[CONFIG] Email provider test:', status.testResult);
      return status;
    } catch (error) {
      status.lastTested = Date.now();
      status.testResult = 'failed';
      status.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return status;
    }
  }

  /**
   * Test SMS provider
   */
  async testSmsProvider(testPhone: string): Promise<ProviderStatus> {
    const status = this.providerStatuses.get('sms');
    if (!status) {
      throw new Error('SMS provider status not found');
    }

    try {
      const result = await notificationProviderService.sendSms(
        testPhone,
        'payment_completed_sms',
        {
          amount: '100',
          reference: 'TEST-REF-001',
        }
      );

      status.lastTested = Date.now();
      status.testResult = result.success ? 'success' : 'failed';
      if (!result.success) {
        status.errorMessage = result.error;
      }

      console.log('[CONFIG] SMS provider test:', status.testResult);
      return status;
    } catch (error) {
      status.lastTested = Date.now();
      status.testResult = 'failed';
      status.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return status;
    }
  }

  /**
   * Test push provider
   */
  async testPushProvider(testDeviceToken: string): Promise<ProviderStatus> {
    const status = this.providerStatuses.get('push');
    if (!status) {
      throw new Error('Push provider status not found');
    }

    try {
      const result = await notificationProviderService.sendPush(
        testDeviceToken,
        'payment_completed_push',
        {
          amount: '100',
          reference: 'TEST-REF-001',
        }
      );

      status.lastTested = Date.now();
      status.testResult = result.success ? 'success' : 'failed';
      if (!result.success) {
        status.errorMessage = result.error;
      }

      console.log('[CONFIG] Push provider test:', status.testResult);
      return status;
    } catch (error) {
      status.lastTested = Date.now();
      status.testResult = 'failed';
      status.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return status;
    }
  }

  /**
   * Run health check on all providers
   */
  async runHealthCheck(): Promise<ProviderHealthCheck> {
    const statuses = Array.from(this.providerStatuses.values());

    // Run tests in parallel
    const results = await Promise.allSettled([
      this.testEmailProvider('health-check@ltcfasttrack.com'),
      this.testSmsProvider('+260960000000'),
      this.testPushProvider('test-device-token'),
    ]);

    return {
      email: statuses[0],
      sms: statuses[1],
      push: statuses[2],
      timestamp: Date.now(),
    };
  }

  /**
   * Get provider status
   */
  getProviderStatus(provider: 'email' | 'sms' | 'push'): ProviderStatus | undefined {
    return this.providerStatuses.get(provider);
  }

  /**
   * Get all provider statuses
   */
  getAllProviderStatuses(): ProviderStatus[] {
    return Array.from(this.providerStatuses.values());
  }

  /**
   * Check if all providers are configured
   */
  areAllProvidersConfigured(): boolean {
    return Array.from(this.providerStatuses.values()).every(status => status.configured);
  }

  /**
   * Get configuration summary
   */
  getConfigurationSummary() {
    const statuses = this.getAllProviderStatuses();
    const configured = statuses.filter(s => s.configured).length;
    const tested = statuses.filter(s => s.lastTested).length;

    return {
      totalProviders: statuses.length,
      configuredProviders: configured,
      testedProviders: tested,
      allConfigured: this.areAllProvidersConfigured(),
      providers: statuses.map(s => ({
        name: s.name,
        provider: s.provider,
        configured: s.configured,
        tested: !!s.lastTested,
        testResult: s.testResult,
      })),
    };
  }
}

// Create singleton instance
export const notificationProviderConfigService = new NotificationProviderConfigService();
