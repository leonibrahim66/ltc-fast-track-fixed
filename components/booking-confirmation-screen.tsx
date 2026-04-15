/**
 * Booking Confirmation Screen
 * Shows pricing breakdown, driver matching, and booking status
 */

import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { ScreenContainer } from './screen-container';
import { cn } from '@/lib/utils';
import type { BookingRequest, DriverMatch } from '@/lib/carrier-booking-types';
import { carrierBookingService } from '@/lib/carrier-booking-service';

interface BookingConfirmationScreenProps {
  booking: BookingRequest;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function BookingConfirmationScreen({
  booking,
  onConfirm,
  onCancel,
}: BookingConfirmationScreenProps) {
  const [driverMatches, setDriverMatches] = useState<DriverMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  useEffect(() => {
    // Simulate finding available drivers
    setTimeout(() => {
      const matches = carrierBookingService.findAvailableDrivers(
        booking.vehicleType,
        booking.pickupLocation,
      );
      setDriverMatches(matches);
      setLoading(false);
    }, 2000);
  }, [booking]);

  const handleConfirmBooking = () => {
    if (selectedDriver) {
      carrierBookingService.assignDriver(booking.id || '', selectedDriver);
      onConfirm?.();
    } else {
      alert('Please select a driver');
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-6 p-4">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">Booking Summary</Text>
            <Text className="text-sm text-muted">Booking ID: {booking.id?.slice(0, 8)}...</Text>
          </View>

          {/* Pricing Breakdown */}
          <View className="bg-surface rounded-lg p-4 gap-3 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">Pricing Breakdown</Text>

            <View className="flex-row justify-between">
              <Text className="text-muted">Base Fare:</Text>
              <Text className="text-foreground font-medium">K{booking.pricing.baseFare}</Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">Distance ({booking.estimatedDistance} km):</Text>
              <Text className="text-foreground font-medium">K{booking.pricing.distanceFare}</Text>
            </View>

            <View className="h-px bg-border my-2" />

            <View className="flex-row justify-between">
              <Text className="text-muted">Subtotal:</Text>
              <Text className="text-foreground font-medium">K{booking.pricing.subtotal}</Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">Tax (10%):</Text>
              <Text className="text-foreground font-medium">K{booking.pricing.tax}</Text>
            </View>

            <View className="h-px bg-border my-2" />

            <View className="flex-row justify-between">
              <Text className="text-lg font-bold text-foreground">Total:</Text>
              <Text className="text-lg font-bold text-primary">K{booking.pricing.total}</Text>
            </View>
          </View>

          {/* Booking Details */}
          <View className="bg-surface rounded-lg p-4 gap-3 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">Booking Details</Text>

            <View>
              <Text className="text-xs text-muted mb-1">📍 From:</Text>
              <Text className="text-foreground font-medium">{booking.pickupLocation.address}</Text>
            </View>

            <View>
              <Text className="text-xs text-muted mb-1">📍 To:</Text>
              <Text className="text-foreground font-medium">{booking.dropoffLocation.address}</Text>
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-xs text-muted mb-1">⏱️ Duration:</Text>
                <Text className="text-foreground font-medium">{booking.estimatedDuration} min</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted mb-1">📦 Weight:</Text>
                <Text className="text-foreground font-medium">
                  {booking.cargo.estimatedWeight} kg
                </Text>
              </View>
            </View>
          </View>

          {/* Driver Selection */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">Available Drivers</Text>
              {loading && <ActivityIndicator color="#0a7ea4" />}
            </View>

            {loading ? (
              <View className="bg-surface p-8 rounded-lg items-center justify-center">
                <ActivityIndicator size="large" color="#0a7ea4" />
                <Text className="text-muted mt-2">Finding nearby drivers...</Text>
              </View>
            ) : driverMatches.length > 0 ? (
              <FlatList
                data={driverMatches}
                keyExtractor={item => item.driver.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => setSelectedDriver(item.driver.id)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View
                      className={cn(
                        'p-4 rounded-lg border-2 flex-row items-center gap-3',
                        selectedDriver === item.driver.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-surface border-border',
                      )}
                    >
                      {/* Driver Avatar */}
                      <View className="w-12 h-12 bg-primary/20 rounded-full items-center justify-center">
                        <Text className="text-lg">👤</Text>
                      </View>

                      {/* Driver Info */}
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Text className="font-semibold text-foreground">{item.driver.name}</Text>
                          <View className="flex-row items-center gap-1 bg-yellow-100 px-2 py-1 rounded">
                            <Text className="text-xs">⭐ {item.driver.rating}</Text>
                          </View>
                        </View>
                        <Text className="text-xs text-muted">
                          {item.driver.totalDeliveries} deliveries • {item.distance} km away
                        </Text>
                        <Text className="text-xs text-success mt-1">
                          Arrives in {item.estimatedArrival} min
                        </Text>
                      </View>

                      {/* Selection Indicator */}
                      <View
                        className={cn(
                          'w-6 h-6 rounded-full border-2 items-center justify-center',
                          selectedDriver === item.driver.id
                            ? 'bg-primary border-primary'
                            : 'border-border',
                        )}
                      >
                        {selectedDriver === item.driver.id && (
                          <View className="w-3 h-3 bg-background rounded-full" />
                        )}
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            ) : (
              <View className="bg-surface p-4 rounded-lg">
                <Text className="text-muted text-center">No drivers available at the moment</Text>
              </View>
            )}
          </View>

          {/* Payment Method */}
          <View className="bg-surface rounded-lg p-4 gap-2 border border-border">
            <Text className="text-sm font-medium text-muted">Payment Method</Text>
            <Text className="text-foreground font-semibold capitalize">
              {booking.paymentMethod.replace('-', ' ')}
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 mt-4">
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="flex-1"
            >
              <View className="bg-border p-4 rounded-lg items-center">
                <Text className="text-foreground font-semibold">Cancel</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={handleConfirmBooking}
              disabled={!selectedDriver || loading}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="flex-1"
            >
              <View
                className={cn(
                  'p-4 rounded-lg items-center',
                  selectedDriver && !loading ? 'bg-primary' : 'bg-border',
                )}
              >
                <Text
                  className={cn(
                    'font-semibold',
                    selectedDriver && !loading ? 'text-background' : 'text-muted',
                  )}
                >
                  Confirm Booking
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
