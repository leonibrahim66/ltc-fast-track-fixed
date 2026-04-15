import React, { createContext, useContext, useState, useCallback } from 'react';

export type CarrierServiceType = 'book-carrier' | 'carrier-portal' | 'track-shipment' | 'available-bookings' | 'earnings';

interface CarrierServiceContextType {
  currentService: CarrierServiceType | null;
  navigateToService: (service: CarrierServiceType) => void;
  goBack: () => void;
  previousService: CarrierServiceType | null;
}

const CarrierServiceContext = createContext<CarrierServiceContextType | undefined>(undefined);

export function CarrierServiceProvider({ children }: { children: React.ReactNode }) {
  const [currentService, setCurrentService] = useState<CarrierServiceType | null>(null);
  const [previousService, setPreviousService] = useState<CarrierServiceType | null>(null);

  const navigateToService = useCallback((service: CarrierServiceType) => {
    setPreviousService(currentService);
    setCurrentService(service);
  }, [currentService]);

  const goBack = useCallback(() => {
    if (previousService) {
      setCurrentService(previousService);
      setPreviousService(null);
    }
  }, [previousService]);

  return (
    <CarrierServiceContext.Provider value={{
      currentService,
      navigateToService,
      goBack,
      previousService,
    }}>
      {children}
    </CarrierServiceContext.Provider>
  );
}

export function useCarrierService() {
  const context = useContext(CarrierServiceContext);
  if (!context) {
    throw new Error('useCarrierService must be used within CarrierServiceProvider');
  }
  return context;
}
