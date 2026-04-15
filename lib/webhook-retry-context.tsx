import React, { createContext, useContext, useState, useCallback } from "react";

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: string;
  statusCode?: number;
  error?: string;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: string;
  lastAttemptAt: string;
  createdAt: string;
  status: "pending" | "delivered" | "failed" | "retrying";
}

interface WebhookRetryContextType {
  deliveries: WebhookDelivery[];
  addDelivery: (delivery: Omit<WebhookDelivery, "id" | "createdAt">) => void;
  retryDelivery: (deliveryId: string) => void;
  markAsDelivered: (deliveryId: string) => void;
  getFailedDeliveries: () => WebhookDelivery[];
  getDeliveriesByWebhook: (webhookId: string) => WebhookDelivery[];
  getRetryingDeliveries: () => WebhookDelivery[];
  getSuccessRate: () => number;
}

const WebhookRetryContext = createContext<WebhookRetryContextType | undefined>(
  undefined
);

export function WebhookRetryProvider({ children }: { children: React.ReactNode }) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([
    {
      id: "delivery-1",
      webhookId: "webhook-001",
      eventType: "pickup.created",
      payload: '{"pickupId": "p123", "status": "pending"}',
      statusCode: 500,
      error: "Internal Server Error",
      attemptCount: 3,
      maxAttempts: 5,
      nextRetryAt: new Date(Date.now() + 3600000).toISOString(),
      lastAttemptAt: new Date(Date.now() - 600000).toISOString(),
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      status: "retrying",
    },
    {
      id: "delivery-2",
      webhookId: "webhook-002",
      eventType: "payment.completed",
      payload: '{"paymentId": "pay456", "amount": 5000}',
      statusCode: 200,
      attemptCount: 1,
      maxAttempts: 5,
      lastAttemptAt: new Date(Date.now() - 1800000).toISOString(),
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      status: "delivered",
    },
    {
      id: "delivery-3",
      webhookId: "webhook-001",
      eventType: "dispute.filed",
      payload: '{"disputeId": "d789", "reason": "incomplete"}',
      statusCode: 0,
      error: "Connection timeout",
      attemptCount: 5,
      maxAttempts: 5,
      lastAttemptAt: new Date(Date.now() - 7200000).toISOString(),
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      status: "failed",
    },
  ]);

  const addDelivery = useCallback(
    (delivery: Omit<WebhookDelivery, "id" | "createdAt">) => {
      const newDelivery: WebhookDelivery = {
        ...delivery,
        id: `delivery-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setDeliveries((prev) => [newDelivery, ...prev]);
    },
    []
  );

  const retryDelivery = useCallback((deliveryId: string) => {
    setDeliveries((prev) =>
      prev.map((delivery) =>
        delivery.id === deliveryId
          ? {
              ...delivery,
              attemptCount: delivery.attemptCount + 1,
              status: delivery.attemptCount + 1 >= delivery.maxAttempts ? "failed" : "retrying",
              lastAttemptAt: new Date().toISOString(),
              nextRetryAt:
                delivery.attemptCount + 1 < delivery.maxAttempts
                  ? new Date(Date.now() + 3600000).toISOString()
                  : undefined,
            }
          : delivery
      )
    );
  }, []);

  const markAsDelivered = useCallback((deliveryId: string) => {
    setDeliveries((prev) =>
      prev.map((delivery) =>
        delivery.id === deliveryId
          ? {
              ...delivery,
              status: "delivered",
              statusCode: 200,
              error: undefined,
              lastAttemptAt: new Date().toISOString(),
            }
          : delivery
      )
    );
  }, []);

  const getFailedDeliveries = useCallback(() => {
    return deliveries.filter((d) => d.status === "failed");
  }, [deliveries]);

  const getDeliveriesByWebhook = useCallback(
    (webhookId: string) => {
      return deliveries.filter((d) => d.webhookId === webhookId);
    },
    [deliveries]
  );

  const getRetryingDeliveries = useCallback(() => {
    return deliveries.filter((d) => d.status === "retrying");
  }, [deliveries]);

  const getSuccessRate = useCallback(() => {
    if (deliveries.length === 0) return 100;
    const successful = deliveries.filter((d) => d.status === "delivered").length;
    return Math.round((successful / deliveries.length) * 100);
  }, [deliveries]);

  return (
    <WebhookRetryContext.Provider
      value={{
        deliveries,
        addDelivery,
        retryDelivery,
        markAsDelivered,
        getFailedDeliveries,
        getDeliveriesByWebhook,
        getRetryingDeliveries,
        getSuccessRate,
      }}
    >
      {children}
    </WebhookRetryContext.Provider>
  );
}

export function useWebhookRetry() {
  const context = useContext(WebhookRetryContext);
  if (!context) {
    throw new Error("useWebhookRetry must be used within WebhookRetryProvider");
  }
  return context;
}
