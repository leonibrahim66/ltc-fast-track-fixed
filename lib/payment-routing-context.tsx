/**
 * Payment Routing Context
 * Manages payment flow navigation and state
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface PaymentFlowState {
  requestId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  paymentType: 'subscription' | 'affiliation_fee';
  amount: number;
  description: string;
  planName?: string;
  planDuration?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  status?: 'pending' | 'completed' | 'failed';
  error?: string;
  reference?: string;
}

interface PaymentRoutingContextType {
  paymentFlow: PaymentFlowState | null;
  paymentResult: PaymentResult | null;
  isProcessing: boolean;
  initiatePayment: (flow: PaymentFlowState) => void;
  completePayment: (result: PaymentResult) => void;
  cancelPayment: () => void;
  resetPaymentFlow: () => void;
  retryPayment: () => void;
}

const PaymentRoutingContext = createContext<PaymentRoutingContextType | undefined>(undefined);

export function PaymentRoutingProvider({ children }: { children: React.ReactNode }) {
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlowState | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const initiatePayment = useCallback((flow: PaymentFlowState) => {
    setPaymentFlow(flow);
    setPaymentResult(null);
    setIsProcessing(true);
  }, []);

  const completePayment = useCallback((result: PaymentResult) => {
    setPaymentResult(result);
    setIsProcessing(false);
  }, []);

  const cancelPayment = useCallback(() => {
    setPaymentFlow(null);
    setPaymentResult(null);
    setIsProcessing(false);
  }, []);

  const resetPaymentFlow = useCallback(() => {
    setPaymentFlow(null);
    setPaymentResult(null);
    setIsProcessing(false);
  }, []);

  const retryPayment = useCallback(() => {
    if (paymentFlow) {
      setPaymentResult(null);
      setIsProcessing(true);
    }
  }, [paymentFlow]);

  const value: PaymentRoutingContextType = {
    paymentFlow,
    paymentResult,
    isProcessing,
    initiatePayment,
    completePayment,
    cancelPayment,
    resetPaymentFlow,
    retryPayment,
  };

  return (
    <PaymentRoutingContext.Provider value={value}>
      {children}
    </PaymentRoutingContext.Provider>
  );
}

export function usePaymentRouting() {
  const context = useContext(PaymentRoutingContext);
  if (!context) {
    throw new Error('usePaymentRouting must be used within PaymentRoutingProvider');
  }
  return context;
}
