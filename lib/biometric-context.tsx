import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform, Alert } from "react-native";

const BIOMETRIC_ENABLED_KEY = "@ltc_biometric_enabled";
const BIOMETRIC_CREDENTIALS_KEY = "@ltc_biometric_credentials";

export type BiometricType = "fingerprint" | "facial" | "iris" | "none";

interface BiometricContextType {
  isSupported: boolean;
  isEnabled: boolean;
  biometricType: BiometricType;
  isEnrolled: boolean;
  isLoading: boolean;
  enableBiometric: (phone: string, password: string) => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<{ success: boolean; phone?: string; password?: string }>;
  checkBiometricAvailability: () => Promise<void>;
}

const BiometricContext = createContext<BiometricContextType | undefined>(undefined);

export function BiometricProvider({ children }: { children: ReactNode }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkBiometricAvailability();
    loadBiometricSettings();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      // Check if device supports biometrics
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsSupported(compatible);

      if (compatible) {
        // Check if biometrics are enrolled
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsEnrolled(enrolled);

        // Get available biometric types
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType("facial");
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType("fingerprint");
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType("iris");
        } else {
          setBiometricType("none");
        }
      }
    } catch (error) {
      console.error("Error checking biometric availability:", error);
    }
  };

  const loadBiometricSettings = async () => {
    try {
      setIsLoading(true);
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      setIsEnabled(enabled === "true");
    } catch (error) {
      console.error("Error loading biometric settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const enableBiometric = async (phone: string, password: string): Promise<boolean> => {
    try {
      if (!isSupported || !isEnrolled) {
        Alert.alert(
          "Biometric Not Available",
          "Your device does not support biometric authentication or no biometrics are enrolled."
        );
        return false;
      }

      // Authenticate first to confirm identity
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to enable biometric login",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Store credentials securely
        await AsyncStorage.setItem(
          BIOMETRIC_CREDENTIALS_KEY,
          JSON.stringify({ phone, password })
        );
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
        setIsEnabled(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error enabling biometric:", error);
      return false;
    }
  };

  const disableBiometric = async () => {
    try {
      await AsyncStorage.removeItem(BIOMETRIC_CREDENTIALS_KEY);
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "false");
      setIsEnabled(false);
    } catch (error) {
      console.error("Error disabling biometric:", error);
    }
  };

  const authenticateWithBiometric = async (): Promise<{ success: boolean; phone?: string; password?: string }> => {
    try {
      if (!isEnabled || !isSupported || !isEnrolled) {
        return { success: false };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: getBiometricPrompt(),
        cancelLabel: "Use Password",
        disableDeviceFallback: true,
      });

      if (result.success) {
        // Retrieve stored credentials
        const credentials = await AsyncStorage.getItem(BIOMETRIC_CREDENTIALS_KEY);
        if (credentials) {
          const { phone, password } = JSON.parse(credentials);
          return { success: true, phone, password };
        }
      }

      return { success: false };
    } catch (error) {
      console.error("Error authenticating with biometric:", error);
      return { success: false };
    }
  };

  const getBiometricPrompt = (): string => {
    switch (biometricType) {
      case "facial":
        return "Login with Face ID";
      case "fingerprint":
        return "Login with Fingerprint";
      case "iris":
        return "Login with Iris Scan";
      default:
        return "Login with Biometrics";
    }
  };

  return (
    <BiometricContext.Provider
      value={{
        isSupported,
        isEnabled,
        biometricType,
        isEnrolled,
        isLoading,
        enableBiometric,
        disableBiometric,
        authenticateWithBiometric,
        checkBiometricAvailability,
      }}
    >
      {children}
    </BiometricContext.Provider>
  );
}

export function useBiometric() {
  const context = useContext(BiometricContext);
  if (context === undefined) {
    throw new Error("useBiometric must be used within a BiometricProvider");
  }
  return context;
}

export function getBiometricLabel(type: BiometricType): string {
  switch (type) {
    case "facial":
      return Platform.OS === "ios" ? "Face ID" : "Face Recognition";
    case "fingerprint":
      return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
    case "iris":
      return "Iris Scan";
    default:
      return "Biometric";
  }
}
