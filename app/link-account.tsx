import React, { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import { formatPhoneNumber, isValidPIN } from "@/lib/validation";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { apiPost } from "@/lib/api-client";
import { getOrCreateBackendUserId } from "@/lib/user-session";

type PaymentProvider = "mtn_momo" | "airtel_money" | "zamtel_money";

interface LinkedAccount {
  id: string;
  phoneNumber: string;
  provider: PaymentProvider;
  isActive: boolean;
  createdAt: string;
}

const providers = [
  {
    id: "mtn_momo" as PaymentProvider,
    name: "MTN Mobile Money",
    icon: "phone-android",
    color: "#FFCC00",
  },
  {
    id: "airtel_money" as PaymentProvider,
    name: "Airtel Money",
    icon: "phone-iphone",
    color: "#ED1C24",
  },
  {
    id: "zamtel_money" as PaymentProvider,
    name: "Zamtel Money",
    icon: "smartphone",
    color: "#00A651",
  },
];

export default function LinkAccountScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { wallet, refreshWallet } = useWallet();
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  // Pre-fill with user's registered phone number for convenience
  const [phoneNumber, setPhoneNumber] = useState((user as any)?.phone || (user as any)?.phoneNumber || "");
  const [withdrawalPin, setWithdrawalPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [existingAccount, setExistingAccount] = useState<LinkedAccount | null>(null);

  // Use wallet state for linked account
  useEffect(() => {
    if (wallet?.linkedAccount) {
      setExistingAccount(wallet.linkedAccount as LinkedAccount);
    }
    setIsFetching(false);
  }, [wallet?.linkedAccount]);

  const handleLinkAccount = async () => {
    // Validation
    if (!selectedProvider) {
      Alert.alert("Select Provider", "Please select a mobile money provider");
      return;
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      Alert.alert("Invalid Phone Number", "Please enter a valid Zambian phone number");
      return;
    }

    if (!isValidPIN(withdrawalPin)) {
      Alert.alert("Invalid PIN", "Please enter a 4-digit withdrawal PIN");
      return;
    }

    if (withdrawalPin !== confirmPin) {
      Alert.alert("PIN Mismatch", "Your PINs do not match. Please try again.");
      return;
    }

    if (!user?.id) {
      Alert.alert("Error", "User not found. Please log in again.");
      return;
    }

    setIsLoading(true);

    try {
      // Ensure we have a stable backend userId (persisted in AsyncStorage)
      const backendUserId = await getOrCreateBackendUserId(user.phone, {
        country: (user as any).country,
        province: user.province,
        city: user.city,
      });

      const result = await apiPost<{ data: LinkedAccount }>(
        `/api/linked-accounts/${backendUserId}/link`,
        {
          phoneNumber: formattedPhone,
          provider: selectedProvider,
          withdrawalPin,
        }
      );

      Alert.alert(
        "Account Linked Successfully",
        `Your ${providers.find((p) => p.id === selectedProvider)?.name} account has been linked. You can now withdraw funds to ${result.data.phoneNumber}.`,
        [
          {
            text: "OK",
            onPress: async () => {
              setExistingAccount(result.data as LinkedAccount);
              setSelectedProvider(null);
              setPhoneNumber("");
              setWithdrawalPin("");
              setConfirmPin("");
              // Refresh wallet state using the stable backend userId
              await refreshWallet(backendUserId);
              router.push("/(tabs)/wallet" as any);
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert("Link Failed", error.message || "Failed to link account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlinkAccount = () => {
    Alert.alert(
      "Unlink Account",
      "Are you sure you want to unlink this account? You won't be able to withdraw funds until you link another account.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Unlink",
          style: "destructive",
            onPress: async () => {
            if (!user?.id) return;

            try {
              setIsLoading(true);
              const backendUserId = await getOrCreateBackendUserId(user.phone);
              await apiPost(`/api/linked-accounts/${backendUserId}/unlink`, {});

              setExistingAccount(null);
              // Refresh wallet state using the stable backend userId
              await refreshWallet(backendUserId);
              Alert.alert("Account Unlinked", "Your account has been unlinked successfully.");
            } catch (error: any) {
              Alert.alert("Unlink Failed", error.message || "Failed to unlink account. Please try again.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  if (isFetching) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted">Loading linked accounts...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Link Account</Text>
            <Text className="text-muted text-sm mt-1">
              Link your mobile money account for withdrawals
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Existing Linked Account */}
        {existingAccount && (
          <View className="px-6 mb-6">
            <View className="bg-primary/10 border border-primary rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <View className="bg-primary rounded-full p-2 mr-3">
                    <MaterialIcons name="check-circle" size={20} color="#fff" />
                  </View>
                  <View>
                    <Text className="text-foreground font-semibold">Account Linked</Text>
                    <Text className="text-muted text-xs mt-1">
                      {providers.find((p) => p.id === existingAccount.provider)?.name}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleUnlinkAccount} disabled={isLoading}>
                  <Text className="text-error font-medium">{isLoading ? "..." : "Unlink"}</Text>
                </TouchableOpacity>
              </View>
              <View className="bg-background rounded-xl p-3">
                <Text className="text-muted text-xs mb-1">Linked Phone Number</Text>
                <Text className="text-foreground font-semibold">{existingAccount.phoneNumber}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Link New Account Form */}
        {!existingAccount && (
          <View className="px-6">
            {/* Select Provider */}
            <View className="mb-6">
              <Text className="text-foreground font-semibold mb-3">Select Mobile Money Provider</Text>
              <View className="gap-3">
                {providers.map((provider) => (
                  <TouchableOpacity
                    key={provider.id}
                    onPress={() => setSelectedProvider(provider.id)}
                    className={`flex-row items-center p-4 rounded-xl border-2 ${
                      selectedProvider === provider.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface"
                    }`}
                  >
                    <View
                      style={{ backgroundColor: `${provider.color}20` }}
                      className="w-12 h-12 rounded-full items-center justify-center mr-3"
                    >
                      <MaterialIcons name={provider.icon as any} size={24} color={provider.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold">{provider.name}</Text>
                      <Text className="text-muted text-xs mt-1">Instant withdrawals</Text>
                    </View>
                      {selectedProvider === provider.id && (
                        <MaterialIcons name="check-circle" size={24} color="#0a7ea4" />
                      )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Phone Number Input */}
            <View className="mb-6">
              <Text className="text-foreground font-semibold mb-2">Phone Number</Text>
              <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
                <Text className="text-muted mr-2">+260</Text>
                <TextInput
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="971234567"
                  keyboardType="phone-pad"
                  maxLength={9}
                  className="flex-1 text-foreground text-base"
                />
              </View>
              <Text className="text-muted text-xs mt-2">
                Enter the phone number registered with your mobile money account
              </Text>
            </View>

            {/* Withdrawal PIN Setup */}
            <View className="mb-6">
              <Text className="text-foreground font-semibold mb-2">Create Withdrawal PIN</Text>
              <TextInput
                value={withdrawalPin}
                onChangeText={setWithdrawalPin}
                placeholder="Enter 4-digit PIN"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base mb-3"
                editable={!isLoading}
              />
              <TextInput
                value={confirmPin}
                onChangeText={setConfirmPin}
                placeholder="Confirm PIN"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
                editable={!isLoading}
              />
              <Text className="text-muted text-xs mt-2">
                You'll need this PIN to authorize withdrawals
              </Text>
            </View>

            {/* Security Notice */}
            <View className="bg-warning/10 border border-warning rounded-xl p-4 mb-6">
              <View className="flex-row items-start">
                <MaterialIcons name="info" size={20} color="#F59E0B" />
                <View className="flex-1 ml-3">
                  <Text className="text-foreground font-semibold mb-1">Security Notice</Text>
                  <Text className="text-muted text-xs leading-5">
                    • Keep your PIN secure and don't share it with anyone{"\n"}
                    • Withdrawals will be sent to the linked phone number{"\n"}
                    • You can change your linked account anytime
                  </Text>
                </View>
              </View>
            </View>

            {/* Link Account Button */}
            <TouchableOpacity
              onPress={handleLinkAccount}
              disabled={isLoading}
              className={`rounded-xl py-4 items-center ${
                isLoading ? "bg-primary/50" : "bg-primary"
              }`}
            >
              <Text className="text-white font-bold text-base">
                {isLoading ? "Linking Account..." : "Link Account"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* How It Works */}
        <View className="px-6 mt-8">
          <Text className="text-foreground font-semibold mb-4">How It Works</Text>
          <View className="gap-4">
            <View className="flex-row items-start">
              <View className="bg-primary rounded-full w-8 h-8 items-center justify-center mr-3">
                <Text className="text-white font-bold">1</Text>
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-medium">Link Your Account</Text>
                <Text className="text-muted text-xs mt-1">
                  Provide your mobile money number and create a secure PIN
                </Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="bg-primary rounded-full w-8 h-8 items-center justify-center mr-3">
                <Text className="text-white font-bold">2</Text>
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-medium">Request Withdrawal</Text>
                <Text className="text-muted text-xs mt-1">
                  Enter amount and confirm with your PIN
                </Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="bg-primary rounded-full w-8 h-8 items-center justify-center mr-3">
                <Text className="text-white font-bold">3</Text>
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-medium">Receive Funds</Text>
                <Text className="text-muted text-xs mt-1">
                  Money is sent to your linked mobile money account within 24-48 hours
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
