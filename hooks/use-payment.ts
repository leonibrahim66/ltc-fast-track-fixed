/**
 * Payment Hook
 * Provides easy-to-use payment functionality for screens
 */

import { useState, useCallback } from "react";
import { Alert, Platform } from "react-native";
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
  PAYMENT_RECEIVERS,
  CURRENCY,
} from "@/lib/payment-services/types";
import { trpc } from "@/lib/trpc";

interface UsePaymentOptions {
  onSuccess?: (response: PaymentResponse) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: PaymentStatusResponse) => void;
  pollInterval?: number; // ms, default 5000
  maxPollAttempts?: number; // default 60 (5 minutes with 5s interval)
}

interface PaymentState {
  isLoading: boolean;
  isPolling: boolean;
  currentTransaction: PaymentResponse | null;
  error: Error | null;
}

export function usePayment(options: UsePaymentOptions = {}) {
  const {
    onSuccess,
    onError,
    onStatusChange,
    pollInterval = 5000,
    maxPollAttempts = 60,
  } = options;

  const [state, setState] = useState<PaymentState>({
    isLoading: false,
    isPolling: false,
    currentTransaction: null,
    error: null,
  });

  // tRPC mutations
  const initiateMutation = trpc.payments.initiate.useMutation();
  const statusQuery = trpc.payments.status.useQuery;

  /**
   * Initiate a payment
   */
  const initiatePayment = useCallback(
    async (params: {
      amount: number;
      provider: PaymentProvider;
      phoneNumber: string;
      description?: string;
      reference?: string;
    }): Promise<PaymentResponse | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Validate phone number
        if (!params.phoneNumber || params.phoneNumber.length < 9) {
          throw new Error("Please enter a valid phone number");
        }

        // Generate reference if not provided
        const reference = params.reference || generateReference();

        const request: PaymentRequest = {
          amount: params.amount,
          currency: CURRENCY.code,
          provider: params.provider,
          phoneNumber: formatPhoneNumber(params.phoneNumber),
          reference,
          description: params.description || "LTC FAST TRACK Payment",
        };

        // Call server to initiate payment
        const response = await initiateMutation.mutateAsync(request);

        const paymentResponse: PaymentResponse = {
          success: response.success,
          transactionId: response.transactionId,
          status: response.status as PaymentResponse["status"],
          message: response.message,
          provider: response.provider as PaymentProvider,
          amount: response.amount,
          currency: response.currency,
          phoneNumber: params.phoneNumber,
          reference: response.reference,
          timestamp: response.timestamp,
        };

        setState((prev) => ({
          ...prev,
          isLoading: false,
          currentTransaction: paymentResponse,
        }));

        if (paymentResponse.success) {
          // Show payment instructions
          showPaymentInstructions(params.provider, params.phoneNumber);
        }

        return paymentResponse;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Payment failed");
        setState((prev) => ({ ...prev, isLoading: false, error: err }));
        onError?.(err);
        return null;
      }
    },
    [initiateMutation, onError]
  );

  /**
   * Poll for payment status
   */
  const pollPaymentStatus = useCallback(
    async (
      transactionId: string,
      provider: PaymentProvider
    ): Promise<PaymentStatusResponse | null> => {
      setState((prev) => ({ ...prev, isPolling: true }));

      let attempts = 0;

      const poll = async (): Promise<PaymentStatusResponse | null> => {
        if (attempts >= maxPollAttempts) {
          setState((prev) => ({ ...prev, isPolling: false }));
          return null;
        }

        attempts++;

        try {
          // In a real implementation, this would use the tRPC query
          // For now, we simulate status checking
          const status: PaymentStatusResponse = {
            transactionId,
            status: "pending",
            amount: 0,
            currency: CURRENCY.code,
            provider,
          };

          onStatusChange?.(status);

          if (status.status === "successful") {
            setState((prev) => ({ ...prev, isPolling: false }));
            onSuccess?.(state.currentTransaction!);
            return status;
          }

          if (status.status === "failed" || status.status === "cancelled") {
            setState((prev) => ({ ...prev, isPolling: false }));
            return status;
          }

          // Continue polling
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          return poll();
        } catch {
          setState((prev) => ({ ...prev, isPolling: false }));
          return null;
        }
      };

      return poll();
    },
    [maxPollAttempts, pollInterval, onStatusChange, onSuccess, state.currentTransaction]
  );

  /**
   * Cancel current payment
   */
  const cancelPayment = useCallback(() => {
    setState({
      isLoading: false,
      isPolling: false,
      currentTransaction: null,
      error: null,
    });
  }, []);

  /**
   * Get receiver number for a provider
   */
  const getReceiverNumber = useCallback((provider: PaymentProvider): string => {
    return PAYMENT_RECEIVERS[provider as keyof typeof PAYMENT_RECEIVERS] || "";
  }, []);

  return {
    ...state,
    initiatePayment,
    pollPaymentStatus,
    cancelPayment,
    getReceiverNumber,
    currency: CURRENCY,
  };
}

// Helper functions

function generateReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LTC${timestamp}${random}`;
}

function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, "");
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, "");
  
  // Add country code if not present
  if (!cleaned.startsWith("260")) {
    cleaned = "260" + cleaned;
  }
  
  return cleaned;
}

function showPaymentInstructions(provider: PaymentProvider, phoneNumber: string) {
  const receiverNumber = PAYMENT_RECEIVERS[provider as keyof typeof PAYMENT_RECEIVERS];
  
  let instructions = "";
  
  switch (provider) {
    case "mtn_momo":
      instructions = `A payment prompt will be sent to ${phoneNumber}.\n\nPlease enter your MTN Mobile Money PIN to complete the payment.\n\nReceiver: ${receiverNumber}`;
      break;
    case "airtel_money":
      instructions = `A payment prompt will be sent to ${phoneNumber}.\n\nPlease enter your Airtel Money PIN to complete the payment.\n\nReceiver: ${receiverNumber}`;
      break;
    default:
      instructions = `Please complete the payment on your phone.\n\nReceiver: ${receiverNumber}`;
  }

  if (Platform.OS !== "web") {
    Alert.alert("Complete Payment", instructions, [{ text: "OK" }]);
  }
}

// Export types
export type { PaymentState, UsePaymentOptions };
