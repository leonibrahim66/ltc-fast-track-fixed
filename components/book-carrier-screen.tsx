/**
 * Book a Carrier Screen
 * Main booking interface for users to book cargo transport
 */

import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, TextInput, Modal, FlatList } from 'react-native';
import { ScreenContainer } from './screen-container';
import { cn } from '@/lib/utils';
import type {
  VehicleType,
  CargoType,
  CustomerType,
  ScheduleInfo,
  Location,
  CargoDetails,
  CustomerInfo,
  PaymentMethod,
} from '@/lib/carrier-booking-types';
import { carrierBookingService } from '@/lib/carrier-booking-service';

type BookingStep = 'vehicle' | 'location' | 'cargo' | 'customer' | 'schedule' | 'payment' | 'review';

export function BookCarrierScreen() {
  const [step, setStep] = useState<BookingStep>('vehicle');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType | null>(null);
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [cargoType, setCargoType] = useState<CargoType | null>(null);
  const [cargoDescription, setCargoDescription] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [numberOfItems, setNumberOfItems] = useState('1');
  const [customerType, setCustomerType] = useState<CustomerType>('individual');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [immediate, setImmediate] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile-money');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationPickerMode, setLocationPickerMode] = useState<'pickup' | 'dropoff'>('pickup');

  const vehicleTypes = carrierBookingService.getAllVehicleTypes();

  const handleNext = () => {
    const steps: BookingStep[] = ['vehicle', 'location', 'cargo', 'customer', 'schedule', 'payment', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: BookingStep[] = ['vehicle', 'location', 'cargo', 'customer', 'schedule', 'payment', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleSelectLocation = (location: Location) => {
    if (locationPickerMode === 'pickup') {
      setPickupLocation(location);
    } else {
      setDropoffLocation(location);
    }
    setShowLocationPicker(false);
  };

  const handleBooking = () => {
    if (!selectedVehicle || !pickupLocation || !dropoffLocation || !cargoType) {
      alert('Please fill in all required fields');
      return;
    }

    const cargo: CargoDetails = {
      type: cargoType,
      description: cargoDescription,
      estimatedWeight: parseFloat(cargoWeight) || 0,
      numberOfItems: parseInt(numberOfItems) || 1,
    };

    const customer: CustomerInfo = {
      type: customerType,
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      companyName: customerType === 'business' ? companyName : undefined,
    };

    const schedule: ScheduleInfo = {
      pickupDate,
      pickupTime,
      immediate,
    };

    try {
      const booking = carrierBookingService.createBooking(
        'user-123', // TODO: Get from auth context
        customer,
        selectedVehicle,
        pickupLocation,
        dropoffLocation,
        cargo,
        schedule,
        paymentMethod,
      );

      alert(`Booking created! ID: ${booking.id}`);
      // TODO: Navigate to booking confirmation screen
    } catch (error) {
      alert('Error creating booking. Please try again.');
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-6 p-4">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Book a Carrier</Text>
            <Text className="text-sm text-muted">Move luggage, goods & cargo easily</Text>
          </View>

          {/* Progress Indicator */}
          <View className="flex-row gap-1">
            {['vehicle', 'location', 'cargo', 'customer', 'schedule', 'payment', 'review'].map(
              (s, i) => (
                <View
                  key={s}
                  className={cn(
                    'flex-1 h-1 rounded-full',
                    s === step ? 'bg-primary' : 'bg-border',
                  )}
                />
              ),
            )}
          </View>

          {/* Step 1: Vehicle Selection */}
          {step === 'vehicle' && (
            <View className="gap-4">
              <Text className="text-lg font-semibold text-foreground">Select Vehicle Type</Text>
              <View className="gap-3">
                {vehicleTypes.map(vehicle => (
                  <Pressable
                    key={vehicle.id}
                    onPress={() => setSelectedVehicle(vehicle.id)}
                    style={({ pressed }) => [
                      {
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View
                      className={cn(
                        'p-4 rounded-lg border-2 flex-row items-center gap-3',
                        selectedVehicle === vehicle.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-surface border-border',
                      )}
                    >
                      <Text className="text-3xl">{vehicle.icon}</Text>
                      <View className="flex-1">
                        <Text className="font-semibold text-foreground">{vehicle.name}</Text>
                        <Text className="text-xs text-muted">{vehicle.capacity}</Text>
                      </View>
                      <Text className="font-semibold text-primary">K{vehicle.baseFare}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Location Selection */}
          {step === 'location' && (
            <View className="gap-4">
              <Text className="text-lg font-semibold text-foreground">Pickup & Drop-off</Text>

              {/* Pickup Location */}
              <Pressable
                onPress={() => {
                  setLocationPickerMode('pickup');
                  setShowLocationPicker(true);
                }}
              >
                <View className="bg-surface p-4 rounded-lg border border-border">
                  <Text className="text-xs text-muted mb-1">📍 Pickup Location</Text>
                  <Text className="text-foreground font-medium">
                    {pickupLocation?.address || 'Select pickup location'}
                  </Text>
                </View>
              </Pressable>

              {/* Drop-off Location */}
              <Pressable
                onPress={() => {
                  setLocationPickerMode('dropoff');
                  setShowLocationPicker(true);
                }}
              >
                <View className="bg-surface p-4 rounded-lg border border-border">
                  <Text className="text-xs text-muted mb-1">📍 Drop-off Location</Text>
                  <Text className="text-foreground font-medium">
                    {dropoffLocation?.address || 'Select drop-off location'}
                  </Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* Step 3: Cargo Details */}
          {step === 'cargo' && (
            <View className="gap-4">
              <Text className="text-lg font-semibold text-foreground">Cargo Details</Text>

              <View>
                <Text className="text-sm font-medium text-foreground mb-2">Type of Item</Text>
                <View className="gap-2">
                  {['luggage', 'furniture', 'electronics', 'food', 'building-materials', 'other'].map(
                    type => (
                      <Pressable
                        key={type}
                        onPress={() => setCargoType(type as CargoType)}
                        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                      >
                        <View
                          className={cn(
                            'p-3 rounded-lg border',
                            cargoType === type ? 'bg-primary/10 border-primary' : 'bg-surface border-border',
                          )}
                        >
                          <Text className="text-foreground capitalize">{type.replace('-', ' ')}</Text>
                        </View>
                      </Pressable>
                    ),
                  )}
                </View>
              </View>

              <View>
                <Text className="text-sm font-medium text-foreground mb-2">Description</Text>
                <TextInput
                  placeholder="Describe your cargo..."
                  value={cargoDescription}
                  onChangeText={setCargoDescription}
                  className="bg-surface p-3 rounded-lg text-foreground border border-border"
                  placeholderTextColor="#999"
                  multiline
                />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground mb-2">Weight (kg)</Text>
                  <TextInput
                    placeholder="0"
                    value={cargoWeight}
                    onChangeText={setCargoWeight}
                    keyboardType="decimal-pad"
                    className="bg-surface p-3 rounded-lg text-foreground border border-border"
                    placeholderTextColor="#999"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground mb-2">Items</Text>
                  <TextInput
                    placeholder="1"
                    value={numberOfItems}
                    onChangeText={setNumberOfItems}
                    keyboardType="number-pad"
                    className="bg-surface p-3 rounded-lg text-foreground border border-border"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Step 4: Customer Type */}
          {step === 'customer' && (
            <View className="gap-4">
              <Text className="text-lg font-semibold text-foreground">Customer Type</Text>

              <View className="gap-3">
                {['individual', 'business'].map(type => (
                  <Pressable
                    key={type}
                    onPress={() => setCustomerType(type as CustomerType)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View
                      className={cn(
                        'p-4 rounded-lg border-2',
                        customerType === type ? 'bg-primary/10 border-primary' : 'bg-surface border-border',
                      )}
                    >
                      <Text className="text-foreground font-semibold capitalize">{type}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              <View className="gap-3">
                <View>
                  <Text className="text-sm font-medium text-foreground mb-2">Full Name</Text>
                  <TextInput
                    placeholder="Your name"
                    value={customerName}
                    onChangeText={setCustomerName}
                    className="bg-surface p-3 rounded-lg text-foreground border border-border"
                    placeholderTextColor="#999"
                  />
                </View>

                <View>
                  <Text className="text-sm font-medium text-foreground mb-2">Phone</Text>
                  <TextInput
                    placeholder="+260..."
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                    keyboardType="phone-pad"
                    className="bg-surface p-3 rounded-lg text-foreground border border-border"
                    placeholderTextColor="#999"
                  />
                </View>

                <View>
                  <Text className="text-sm font-medium text-foreground mb-2">Email</Text>
                  <TextInput
                    placeholder="your@email.com"
                    value={customerEmail}
                    onChangeText={setCustomerEmail}
                    keyboardType="email-address"
                    className="bg-surface p-3 rounded-lg text-foreground border border-border"
                    placeholderTextColor="#999"
                  />
                </View>

                {customerType === 'business' && (
                  <View>
                    <Text className="text-sm font-medium text-foreground mb-2">Company Name</Text>
                    <TextInput
                      placeholder="Your company"
                      value={companyName}
                      onChangeText={setCompanyName}
                      className="bg-surface p-3 rounded-lg text-foreground border border-border"
                      placeholderTextColor="#999"
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Step 5: Schedule */}
          {step === 'schedule' && (
            <View className="gap-4">
              <Text className="text-lg font-semibold text-foreground">Schedule Pickup</Text>

              <View className="gap-3">
                <Pressable
                  onPress={() => setImmediate(!immediate)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View
                    className={cn(
                      'p-4 rounded-lg border-2 flex-row items-center justify-between',
                      immediate ? 'bg-primary/10 border-primary' : 'bg-surface border-border',
                    )}
                  >
                    <Text className="text-foreground font-medium">Immediate Pickup</Text>
                    <View
                      className={cn(
                        'w-6 h-6 rounded-full border-2 items-center justify-center',
                        immediate ? 'bg-primary border-primary' : 'border-border',
                      )}
                    >
                      {immediate && <View className="w-3 h-3 bg-background rounded-full" />}
                    </View>
                  </View>
                </Pressable>

                {!immediate && (
                  <>
                    <View>
                      <Text className="text-sm font-medium text-foreground mb-2">Date</Text>
                      <TextInput
                        placeholder="YYYY-MM-DD"
                        value={pickupDate}
                        onChangeText={setPickupDate}
                        className="bg-surface p-3 rounded-lg text-foreground border border-border"
                        placeholderTextColor="#999"
                      />
                    </View>

                    <View>
                      <Text className="text-sm font-medium text-foreground mb-2">Time</Text>
                      <TextInput
                        placeholder="HH:mm"
                        value={pickupTime}
                        onChangeText={setPickupTime}
                        className="bg-surface p-3 rounded-lg text-foreground border border-border"
                        placeholderTextColor="#999"
                      />
                    </View>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Step 6: Payment */}
          {step === 'payment' && (
            <View className="gap-4">
              <Text className="text-lg font-semibold text-foreground">Payment Method</Text>

              <View className="gap-3">
                {['mobile-money', 'card', 'cash-on-delivery'].map(method => (
                  <Pressable
                    key={method}
                    onPress={() => setPaymentMethod(method as PaymentMethod)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View
                      className={cn(
                        'p-4 rounded-lg border-2',
                        paymentMethod === method ? 'bg-primary/10 border-primary' : 'bg-surface border-border',
                      )}
                    >
                      <Text className="text-foreground font-semibold capitalize">
                        {method.replace('-', ' ')}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Step 7: Review */}
          {step === 'review' && (
            <View className="gap-4">
              <Text className="text-lg font-semibold text-foreground">Review Booking</Text>

              <View className="bg-surface p-4 rounded-lg gap-3">
                <View className="flex-row justify-between">
                  <Text className="text-muted">Vehicle:</Text>
                  <Text className="text-foreground font-medium">
                    {vehicleTypes.find(v => v.id === selectedVehicle)?.name}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-muted">Distance:</Text>
                  <Text className="text-foreground font-medium">
                    {selectedVehicle && pickupLocation && dropoffLocation
                      ? `${carrierBookingService
                          .calculateDistance(pickupLocation, dropoffLocation)
                          .toFixed(1)} km`
                      : 'N/A'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Navigation Buttons */}
          <View className="flex-row gap-3 mt-6">
            {step !== 'vehicle' && (
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1"
              >
                <View className="bg-border p-4 rounded-lg items-center">
                  <Text className="text-foreground font-semibold">Back</Text>
                </View>
              </Pressable>
            )}

            <Pressable
              onPress={step === 'review' ? handleBooking : handleNext}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="flex-1"
            >
              <View className="bg-primary p-4 rounded-lg items-center">
                <Text className="text-background font-semibold">
                  {step === 'review' ? 'Book Carrier Now' : 'Next'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Location Picker Modal */}
      <Modal visible={showLocationPicker} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-2xl p-4 max-h-96">
            <Text className="text-lg font-semibold text-foreground mb-4">Select Location</Text>

            <FlatList
              data={[
                {
                  latitude: -10.8335,
                  longitude: 34.5085,
                  address: 'Lusaka City Center',
                  placeId: 'lusaka-center',
                },
                {
                  latitude: -10.8,
                  longitude: 34.75,
                  address: 'Arcades Shopping Mall',
                  placeId: 'arcades',
                },
                {
                  latitude: -10.85,
                  longitude: 34.5,
                  address: 'Kamwala',
                  placeId: 'kamwala',
                },
              ]}
              keyExtractor={item => item.placeId || ''}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectLocation(item)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="p-3 border-b border-border">
                    <Text className="text-foreground font-medium">{item.address}</Text>
                  </View>
                </Pressable>
              )}
            />

            <Pressable
              onPress={() => setShowLocationPicker(false)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="bg-border p-3 rounded-lg mt-4 items-center">
                <Text className="text-foreground font-semibold">Cancel</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
