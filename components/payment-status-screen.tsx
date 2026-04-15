/**
 * Payment Status and Result Screens
 */

import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ScreenContainer } from './screen-container';
import { cn } from '@/lib/utils';
import { useColors } from '@/hooks/use-colors';

export interface PaymentStatusScreenProps {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed';
  amount: number;
  description: string;
  reference?: string;
  onClose?: () => void;
  onRetry?: () => void;
}

export function PaymentStatusScreen({
  transactionId,
  status,
  amount,
  description,
  reference,
  onClose,
  onRetry,
}: PaymentStatusScreenProps) {
  const colors = useColors();

  const isSuccess = status === 'completed';
  const isPending = status === 'pending';
  const isFailed = status === 'failed';

  const statusConfig = {
    completed: {
      icon: '✓',
      title: 'Payment Successful',
      message: 'Your payment has been received and verified.',
      color: colors.success,
      bgColor: '#22C55E20',
    },
    pending: {
      icon: '⏳',
      title: 'Payment Processing',
      message: 'Your payment is being processed. Please wait...',
      color: colors.warning,
      bgColor: '#F59E0B20',
    },
    failed: {
      icon: '✕',
      title: 'Payment Failed',
      message: 'Your payment could not be processed. Please try again.',
      color: colors.error,
      bgColor: '#EF444420',
    },
  };

  const config = statusConfig[status];

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6 justify-center">
          {/* Status Icon */}
          <View className="items-center">
            <View
              className="w-24 h-24 rounded-full items-center justify-center"
              style={{ backgroundColor: config.bgColor }}
            >
              <Text className="text-5xl" style={{ color: config.color }}>
                {config.icon}
              </Text>
            </View>
          </View>

          {/* Status Title */}
          <View className="gap-2 items-center">
            <Text className="text-3xl font-bold text-foreground">{config.title}</Text>
            <Text className="text-base text-muted text-center">{config.message}</Text>
          </View>

          {/* Amount */}
          <View
            className="rounded-2xl p-6 items-center gap-2"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-sm text-muted">Amount</Text>
            <Text className="text-4xl font-bold text-foreground">K{amount}</Text>
            <Text className="text-sm text-muted mt-2">{description}</Text>
          </View>

          {/* Transaction Details */}
          <View
            className="rounded-xl p-4 gap-3"
            style={{ backgroundColor: colors.surface }}
          >
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-muted">Transaction ID</Text>
              <Text className="text-sm font-mono text-foreground">{transactionId}</Text>
            </View>

            {reference && (
              <View className="flex-row justify-between items-center border-t border-border pt-3">
                <Text className="text-sm text-muted">Reference</Text>
                <Text className="text-sm font-mono text-foreground">{reference}</Text>
              </View>
            )}

            <View className="flex-row justify-between items-center border-t border-border pt-3">
              <Text className="text-sm text-muted">Status</Text>
              <Text
                className={cn(
                  'text-sm font-semibold px-3 py-1 rounded-full',
                  isSuccess && 'bg-success/20 text-success',
                  isPending && 'bg-warning/20 text-warning',
                  isFailed && 'bg-error/20 text-error'
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Status-specific Messages */}
          {isPending && (
            <View
              className="rounded-lg p-4 gap-2"
              style={{ backgroundColor: colors.warning + '20' }}
            >
              <Text className="text-sm font-semibold text-warning">⏳ Processing</Text>
              <Text className="text-xs text-warning">
                Your payment is being processed. This may take a few minutes. We'll notify you once it's confirmed.
              </Text>
            </View>
          )}

          {isFailed && (
            <View
              className="rounded-lg p-4 gap-2"
              style={{ backgroundColor: colors.error + '20' }}
            >
              <Text className="text-sm font-semibold text-error">❌ Payment Failed</Text>
              <Text className="text-xs text-error">
                Your payment could not be processed. Please check your account balance and try again, or contact support.
              </Text>
            </View>
          )}

          {isSuccess && (
            <View
              className="rounded-lg p-4 gap-2"
              style={{ backgroundColor: colors.success + '20' }}
            >
              <Text className="text-sm font-semibold text-success">✓ Payment Confirmed</Text>
              <Text className="text-xs text-success">
                Your payment has been successfully processed. Your subscription is now active.
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="gap-3 mt-4">
            {isFailed && (
              <Pressable
                onPress={onRetry}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View
                  className="flex-row items-center justify-center rounded-full py-4"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="text-base font-semibold text-background">Try Again</Text>
                </View>
              </Pressable>
            )}

            <Pressable
              onPress={onClose}
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
                <Text className="text-base font-semibold text-foreground">
                  {isSuccess ? 'Continue' : 'Close'}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Support Info */}
          <View
            className="rounded-lg p-3 gap-1"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-xs font-semibold text-muted">Need Help?</Text>
            <Text className="text-xs text-muted">
              Contact our support team at support@ltcfasttrack.com or call +260 960 819 993
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
