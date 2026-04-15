/**
 * Carrier Booking Context
 * Manages booking state and navigation across the app
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { BookingRequest } from './carrier-booking-types';

type BookingStep = 'home' | 'booking-form' | 'confirmation' | 'tracking' | 'history';

interface CarrierBookingContextType {
  currentStep: BookingStep;
  currentBooking: BookingRequest | null;
  bookingHistory: BookingRequest[];
  
  // Navigation
  goToBookingForm: () => void;
  goToConfirmation: (booking: BookingRequest) => void;
  goToTracking: (booking: BookingRequest) => void;
  goToHistory: () => void;
  goHome: () => void;
  
  // Booking Management
  setCurrentBooking: (booking: BookingRequest | null) => void;
  addToHistory: (booking: BookingRequest) => void;
  getBookingById: (id: string) => BookingRequest | undefined;
}

const CarrierBookingContext = createContext<CarrierBookingContextType | undefined>(undefined);

export function CarrierBookingProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<BookingStep>('home');
  const [currentBooking, setCurrentBooking] = useState<BookingRequest | null>(null);
  const [bookingHistory, setBookingHistory] = useState<BookingRequest[]>([]);

  const goToBookingForm = () => {
    setCurrentStep('booking-form');
    setCurrentBooking(null);
  };

  const goToConfirmation = (booking: BookingRequest) => {
    setCurrentBooking(booking);
    setCurrentStep('confirmation');
  };

  const goToTracking = (booking: BookingRequest) => {
    setCurrentBooking(booking);
    setCurrentStep('tracking');
  };

  const goToHistory = () => {
    setCurrentStep('history');
  };

  const goHome = () => {
    setCurrentStep('home');
    setCurrentBooking(null);
  };

  const addToHistory = (booking: BookingRequest) => {
    setBookingHistory(prev => [booking, ...prev]);
  };

  const getBookingById = (id: string): BookingRequest | undefined => {
    return bookingHistory.find(b => b.id === id);
  };

  const value: CarrierBookingContextType = {
    currentStep,
    currentBooking,
    bookingHistory,
    goToBookingForm,
    goToConfirmation,
    goToTracking,
    goToHistory,
    goHome,
    setCurrentBooking,
    addToHistory,
    getBookingById,
  };

  return (
    <CarrierBookingContext.Provider value={value}>
      {children}
    </CarrierBookingContext.Provider>
  );
}

export function useCarrierBooking(): CarrierBookingContextType {
  const context = useContext(CarrierBookingContext);
  if (!context) {
    throw new Error('useCarrierBooking must be used within CarrierBookingProvider');
  }
  return context;
}
