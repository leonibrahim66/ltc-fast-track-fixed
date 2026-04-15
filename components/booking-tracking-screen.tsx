/**
 * Booking Tracking Screen
 * Real-time tracking of carrier and booking status
 */

import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { ScreenContainer } from './screen-container';
import { cn } from '@/lib/utils';
import type { BookingRequest } from '@/lib/carrier-booking-types';

interface BookingTrackingScreenProps {
  booking: BookingRequest;
  onChat?: () => void;
  onCancel?: () => void;
}

export function BookingTrackingScreen({
  booking,
  onChat,
  onCancel,
}: BookingTrackingScreenProps) {
  const [bookingStatus, setBookingStatus] = useState(booking.status);

  // Simulate status updates
  useEffect(() => {
    const statusSequence: typeof booking.status[] = [
      'searching',
      'accepted',
      'on-the-way',
      'delivered',
    ];
    const currentIndex = statusSequence.indexOf(bookingStatus);

    if (currentIndex < statusSequence.length - 1) {
      const timer = setTimeout(() => {
        setBookingStatus(statusSequence[currentIndex + 1]);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [bookingStatus]);

  const getStatusIcon = (status: typeof booking.status) => {
    const icons: Record<typeof booking.status, string> = {
      pending: '⏳',
      searching: '🔍',
      accepted: '✅',
      'on-the-way': '🚚',
      delivered: '🎉',
      cancelled: '❌',
    };
    return icons[status] || '❓';
  };

  const getStatusLabel = (status: typeof booking.status) => {
    const labels: Record<typeof booking.status, string> = {
      pending: 'Pending',
      searching: 'Searching for drivers',
      accepted: 'Driver Accepted',
      'on-the-way': 'On the way',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };
    return labels[status] || 'Unknown';
  };

  const statusSteps = ['searching', 'accepted', 'on-the-way', 'delivered'] as const;
  const currentStepIndex = statusSteps.indexOf(bookingStatus as any);

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-6 p-4">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">Tracking</Text>
            <Text className="text-sm text-muted">Booking ID: {booking.id?.slice(0, 8)}...</Text>
          </View>

          {/* Status Timeline */}
          <View className="bg-surface rounded-lg p-6 border border-border">
            <View className="gap-4">
              {statusSteps.map((step, index) => (
                <View key={step} className="flex-row gap-4">
                  {/* Timeline Dot */}
                  <View className="items-center gap-2">
                    <View
                      className={cn(
                        'w-10 h-10 rounded-full items-center justify-center border-2',
                        index <= currentStepIndex
                          ? 'bg-primary border-primary'
                          : 'bg-surface border-border',
                      )}
                    >
                      <Text className={cn(index <= currentStepIndex ? 'text-background' : 'text-muted')}>
                        {index + 1}
                      </Text>
                    </View>

                    {/* Timeline Line */}
                    {index < statusSteps.length - 1 && (
                      <View
                        className={cn(
                          'w-1 h-12',
                          index < currentStepIndex ? 'bg-primary' : 'bg-border',
                        )}
                      />
                    )}
                  </View>

                  {/* Status Info */}
                  <View className="flex-1 justify-center">
                    <Text
                      className={cn(
                        'font-semibold',
                        index <= currentStepIndex ? 'text-foreground' : 'text-muted',
                      )}
                    >
                      {getStatusLabel(step)}
                    </Text>
                    {index === currentStepIndex && (
                      <Text className="text-xs text-primary mt-1">In progress...</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Driver Information */}
          {booking.driver && (
            <View className="bg-surface rounded-lg p-4 border border-border gap-4">
              <Text className="text-lg font-semibold text-foreground">Driver Details</Text>

              <View className="flex-row items-center gap-4">
                {/* Driver Avatar */}
                <View className="w-16 h-16 bg-primary/20 rounded-full items-center justify-center">
                  <Text className="text-3xl">👤</Text>
                </View>

                {/* Driver Info */}
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">{booking.driver.name}</Text>
                  <View className="flex-row items-center gap-2 mt-1">
                    <Text className="text-sm text-muted">⭐ {booking.driver.rating}</Text>
                    <Text className="text-sm text-muted">•</Text>
                    <Text className="text-sm text-muted">{booking.driver.totalDeliveries} trips</Text>
                  </View>
                </View>
              </View>

              {/* Vehicle Info */}
              <View className="bg-background rounded-lg p-3 gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-muted">Vehicle:</Text>
                  <Text className="text-foreground font-medium">{booking.driver.vehiclePlate}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-muted">Type:</Text>
                  <Text className="text-foreground font-medium capitalize">
                    {booking.vehicleType.replace('-', ' ')}
                  </Text>
                </View>
              </View>

              {/* Contact Button */}
              <Pressable
                onPress={onChat}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="bg-primary p-3 rounded-lg items-center flex-row justify-center gap-2">
                  <Text className="text-lg">💬</Text>
                  <Text className="text-background font-semibold">Message Driver</Text>
                </View>
              </Pressable>

              <Pressable
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="bg-border p-3 rounded-lg items-center flex-row justify-center gap-2">
                  <Text className="text-lg">📞</Text>
                  <Text className="text-foreground font-semibold">{booking.driver.phone}</Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* Pickup & Dropoff */}
          <View className="bg-surface rounded-lg p-4 border border-border gap-4">
            <Text className="text-lg font-semibold text-foreground">Route</Text>

            <View className="gap-3">
              <View>
                <Text className="text-xs text-muted mb-1">📍 Pickup</Text>
                <Text className="text-foreground font-medium">{booking.pickupLocation.address}</Text>
              </View>

              <View className="items-center">
                <View className="w-1 h-6 bg-primary" />
              </View>

              <View>
                <Text className="text-xs text-muted mb-1">📍 Dropoff</Text>
                <Text className="text-foreground font-medium">{booking.dropoffLocation.address}</Text>
              </View>
            </View>

            <View className="bg-background rounded-lg p-3 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-muted">Distance:</Text>
                <Text className="text-foreground font-medium">{booking.estimatedDistance} km</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted">Est. Time:</Text>
                <Text className="text-foreground font-medium">{booking.estimatedDuration} min</Text>
              </View>
            </View>
          </View>

          {/* Cargo Details */}
          <View className="bg-surface rounded-lg p-4 border border-border gap-3">
            <Text className="text-lg font-semibold text-foreground">Cargo Details</Text>

            <View className="bg-background rounded-lg p-3 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-muted">Type:</Text>
                <Text className="text-foreground font-medium capitalize">
                  {booking.cargo.type.replace('-', ' ')}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted">Weight:</Text>
                <Text className="text-foreground font-medium">{booking.cargo.estimatedWeight} kg</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted">Items:</Text>
                <Text className="text-foreground font-medium">{booking.cargo.numberOfItems}</Text>
              </View>
            </View>
          </View>

          {/* Pricing Summary */}
          <View className="bg-surface rounded-lg p-4 border border-border gap-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-lg font-semibold text-foreground">Total Price</Text>
              <Text className="text-2xl font-bold text-primary">K{booking.pricing.total}</Text>
            </View>

            <View className="bg-background rounded-lg p-3">
              <Text className="text-xs text-muted">
                Payment: {booking.paymentMethod.replace('-', ' ')}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          {bookingStatus !== 'delivered' && (
            <View className="flex-row gap-3">
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1"
              >
                <View className="bg-error/10 p-4 rounded-lg items-center border border-error">
                  <Text className="text-error font-semibold">Cancel Booking</Text>
                </View>
              </Pressable>
            </View>
          )}

          {bookingStatus === 'delivered' && (
            <View className="bg-success/10 p-4 rounded-lg border border-success items-center">
              <Text className="text-success font-semibold">✅ Delivery Complete</Text>
              <Text className="text-xs text-success mt-1">Thank you for using our service!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
