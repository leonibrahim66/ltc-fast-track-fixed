/**
 * Payment Processing Screen Component
 * Handles payment initiation and processing UI
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { ScreenContainer } from './screen-container';
import { cn } from '@/lib/utils';
import { useColors } from '@/hooks/use-colors';
import { zynlepayIntegrationService, type PaymentScreenData } from '@/lib/zynlepay-integration';

export interface PaymentScreenProps {
  requestId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  paymentType: 'subscription' | 'affiliation_fee';
  amount: number;
  description: string;
  onSuccess?: (transactionId: string, paymentUrl: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

export function PaymentScreen({
  requestId,
  userId,
  userName,
  userEmail,
  userPhone,
  paymentType,
  amount,
  description,
  onSuccess,
  onError,
  onCancel,
}: PaymentScreenProps) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const paymentMethods = [
    { id: 'mtn', label: 'MTN Mobile Money', icon: '📱' },
    { id: 'airtel', label: 'Airtel Money', icon: '📱' },
    { id: 'bank', label: 'Bank Transfer', icon: '🏦' },
    { id: 'card', label: 'Card Payment', icon: '💳' },
  ];

  const handlePaymentInitiation = async () => {
    if (!selectedMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    setLoading(true);

    try {
      const paymentData: PaymentScreenData = {
        requestId,
        userId,
        userName,
        userEmail,
        userPhone,
        paymentType,
        amount,
        description,
        metadata: {
          paymentMethod: selectedMethod,
        },
      };

      const result =
        paymentType === 'subscription'
          ? await zynlepayIntegrationService.processSubscriptionPayment(paymentData)
          : await zynlepayIntegrationService.processAffiliationFeePayment(paymentData);

      if (result.success && result.transactionId && result.paymentUrl) {
        onSuccess?.(result.transactionId, result.paymentUrl);
      } else {
        onError?.(result.error || result.message);
        Alert.alert('Payment Error', result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment initialization failed';
      onError?.(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Payment</Text>
            <Text className="text-base text-muted">
              {paymentType === 'subscription' ? 'Subscription Payment' : 'Affiliation Fee'}
            </Text>
          </View>

          {/* Amount Display */}
          <View
            className="rounded-2xl p-6"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-sm text-muted mb-2">Amount to Pay</Text>
            <Text className="text-4xl font-bold text-foreground">K{amount}</Text>
            <Text className="text-sm text-muted mt-2">{description}</Text>
          </View>

          {/* Payment Methods */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Select Payment Method</Text>

            {paymentMethods.map(method => (
              <Pressable
                key={method.id}
                onPress={() => setSelectedMethod(method.id)}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View
                  className={cn(
                    'flex-row items-center gap-4 rounded-xl p-4 border-2',
                    selectedMethod === method.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface'
                  )}
                >
                  <Text className="text-2xl">{method.icon}</Text>
                  <View className="flex-1">
                    <Text
                      className={cn(
                        'font-semibold',
                        selectedMethod === method.id ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {method.label}
                    </Text>
                  </View>
                  {selectedMethod === method.id && (
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <Text className="text-white font-bold">✓</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          {/* User Info */}
          <View
            className="rounded-xl p-4 gap-2"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-xs text-muted uppercase">Payment Details</Text>
            <Text className="text-sm text-foreground">
              <Text className="font-semibold">Name:</Text> {userName}
            </Text>
            <Text className="text-sm text-foreground">
              <Text className="font-semibold">Email:</Text> {userEmail}
            </Text>
            <Text className="text-sm text-foreground">
              <Text className="font-semibold">Phone:</Text> {userPhone}
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="gap-3 mt-4">
            <Pressable
              onPress={handlePaymentInitiation}
              disabled={loading}
              style={({ pressed }) => [
                {
                  opacity: pressed && !loading ? 0.9 : 1,
                },
              ]}
            >
              <View
                className={cn(
                  'flex-row items-center justify-center gap-2 rounded-full py-4',
                  loading ? 'opacity-70' : ''
                )}
                style={{ backgroundColor: colors.primary }}
              >
                {loading ? (
                  <>
                    <ActivityIndicator color={colors.background} size="small" />
                    <Text className="text-base font-semibold text-background">Processing...</Text>
                  </>
                ) : (
                  <Text className="text-base font-semibold text-background">Proceed to Payment</Text>
                )}
              </View>
            </Pressable>

            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                className="flex-row items-center justify-center rounded-full py-3 border-2"
                style={{ borderColor: colors.border }}
              >
                <Text className="text-base font-semibold text-foreground">Cancel</Text>
              </View>
            </Pressable>
          </View>

          {/* Security Notice */}
          <View
            className="rounded-lg p-3 gap-1"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-xs font-semibold text-muted">🔒 Secure Payment</Text>
            <Text className="text-xs text-muted">
              Your payment is processed securely through Zynlepay. Your financial information is encrypted and protected.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
