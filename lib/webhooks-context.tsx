import React, { createContext, useContext, useState, useCallback } from 'react';

export interface WebhookEvent {
  id: string;
  type: 'pickup.created' | 'pickup.completed' | 'payment.processed' | 'dispute.filed' | 'subscription.activated' | 'subscription.cancelled';
  timestamp: string;
  data: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  apiKeyId: string;
  events: WebhookEvent['type'][];
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
  failureCount: number;
  successCount: number;
}

export interface WebhookContextType {
  webhooks: Webhook[];
  webhookEvents: WebhookEvent[];
  createWebhook: (name: string, url: string, apiKeyId: string, events: WebhookEvent['type'][]) => Webhook;
  deleteWebhook: (webhookId: string) => void;
  toggleWebhook: (webhookId: string) => void;
  getWebhookEvents: (webhookId: string) => WebhookEvent[];
  triggerWebhook: (webhookId: string, eventType: WebhookEvent['type'], data: Record<string, any>) => void;
  getWebhookStats: (webhookId: string) => { successCount: number; failureCount: number; lastTriggeredAt?: string };
}

const WebhooksContext = createContext<WebhookContextType | undefined>(undefined);

export function WebhooksProvider({ children }: { children: React.ReactNode }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    {
      id: 'webhook-001',
      name: 'Pickup Events',
      url: 'https://example.com/webhooks/pickups',
      apiKeyId: 'key-001',
      events: ['pickup.created', 'pickup.completed'],
      isActive: true,
      createdAt: '2025-12-15T10:00:00Z',
      lastTriggeredAt: '2026-01-08T06:30:00Z',
      failureCount: 2,
      successCount: 156,
    },
  ]);

  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([
    {
      id: 'event-001',
      type: 'pickup.created',
      timestamp: '2026-01-08T06:30:00Z',
      data: { pickupId: 'p-123', customerId: 'c-456', address: '123 Main St' },
      status: 'delivered',
      attempts: 1,
    },
  ]);

  const createWebhook = useCallback(
    (name: string, url: string, apiKeyId: string, events: WebhookEvent['type'][]) => {
      const newWebhook: Webhook = {
        id: `webhook-${Date.now()}`,
        name,
        url,
        apiKeyId,
        events,
        isActive: true,
        createdAt: new Date().toISOString(),
        failureCount: 0,
        successCount: 0,
      };

      setWebhooks([...webhooks, newWebhook]);
      return newWebhook;
    },
    [webhooks]
  );

  const deleteWebhook = useCallback(
    (webhookId: string) => {
      setWebhooks(webhooks.filter(w => w.id !== webhookId));
      setWebhookEvents(webhookEvents.filter(e => e.id !== webhookId));
    },
    [webhooks, webhookEvents]
  );

  const toggleWebhook = useCallback(
    (webhookId: string) => {
      setWebhooks(webhooks.map(w => (w.id === webhookId ? { ...w, isActive: !w.isActive } : w)));
    },
    [webhooks]
  );

  const getWebhookEvents = useCallback(
    (webhookId: string) => {
      return webhookEvents.filter(e => e.id.startsWith(webhookId));
    },
    [webhookEvents]
  );

  const triggerWebhook = useCallback(
    (webhookId: string, eventType: WebhookEvent['type'], data: Record<string, any>) => {
      const newEvent: WebhookEvent = {
        id: `event-${Date.now()}`,
        type: eventType,
        timestamp: new Date().toISOString(),
        data,
        status: 'pending',
        attempts: 0,
      };

      setWebhookEvents([...webhookEvents, newEvent]);

      // Simulate webhook delivery
      setTimeout(() => {
        setWebhookEvents(prev =>
          prev.map(e =>
            e.id === newEvent.id
              ? { ...e, status: 'delivered', attempts: 1 }
              : e
          )
        );

        setWebhooks(prev =>
          prev.map(w =>
            w.id === webhookId
              ? { ...w, successCount: w.successCount + 1, lastTriggeredAt: new Date().toISOString() }
              : w
          )
        );
      }, 1000);
    },
    [webhookEvents]
  );

  const getWebhookStats = useCallback(
    (webhookId: string) => {
      const webhook = webhooks.find(w => w.id === webhookId);
      return {
        successCount: webhook?.successCount || 0,
        failureCount: webhook?.failureCount || 0,
        lastTriggeredAt: webhook?.lastTriggeredAt,
      };
    },
    [webhooks]
  );

  return (
    <WebhooksContext.Provider
      value={{
        webhooks,
        webhookEvents,
        createWebhook,
        deleteWebhook,
        toggleWebhook,
        getWebhookEvents,
        triggerWebhook,
        getWebhookStats,
      }}
    >
      {children}
    </WebhooksContext.Provider>
  );
}

export function useWebhooks() {
  const context = useContext(WebhooksContext);
  if (!context) {
    throw new Error('useWebhooks must be used within WebhooksProvider');
  }
  return context;
}
