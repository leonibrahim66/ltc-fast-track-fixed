/**
 * Carrier Booking Card Component
 * Home page card for Book a Carrier feature
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCarrierBooking } from '@/lib/carrier-booking-context';

export function CarrierBookingCard() {
  const { goToBookingForm } = useCarrierBooking();

  return (
    <Pressable
      onPress={goToBookingForm}
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200 shadow-sm">
        <View className="flex-row items-start justify-between mb-3">
          <Text className="text-4xl">🚚</Text>
          <View className="bg-blue-500 px-3 py-1 rounded-full">
            <Text className="text-white text-xs font-semibold">New</Text>
          </View>
        </View>

        <Text className="text-xl font-bold text-gray-900 mb-2">Book a Carrier</Text>
        <Text className="text-sm text-gray-600 leading-relaxed">
          Move luggage, goods & cargo easily with our carrier service
        </Text>

        <View className="mt-4 flex-row items-center gap-2">
          <Text className="text-blue-600 font-semibold">Get Started →</Text>
        </View>
      </View>
    </Pressable>
  );
}
