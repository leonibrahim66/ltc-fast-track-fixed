import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useWithdrawals, AutoWithdrawalSettings } from "@/lib/withdrawals-context";

type WithdrawMethod = "mtn" | "airtel" | "bank";
type Frequency = "weekly" | "monthly";

const METHODS = [
  { id: "mtn" as WithdrawMethod, name: "MTN Mobile Money", icon: "📱" },
  { id: "airtel" as WithdrawMethod, name: "Airtel Money", icon: "📲" },
  { id: "bank" as WithdrawMethod, name: "Bank Transfer", icon: "🏦" },
];

const FREQUENCIES = [
  { id: "weekly" as Frequency, name: "Weekly", description: "Every Monday" },
  { id: "monthly" as Frequency, name: "Monthly", description: "1st of each month" },
];

const THRESHOLD_OPTIONS = [100, 250, 500, 1000, 2500, 5000];

export default function AutoWithdrawalScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { autoSettings, saveAutoSettings, clearAutoSettings } = useWithdrawals();

  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState("500");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [method, setMethod] = useState<WithdrawMethod>("mtn");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load existing settings
  useEffect(() => {
    if (autoSettings) {
      setEnabled(autoSettings.enabled);
      setThreshold(autoSettings.threshold.toString());
      setFrequency(autoSettings.frequency);
      setMethod(autoSettings.method);
      setAccountNumber(autoSettings.accountNumber);
      setAccountName(autoSettings.accountName || "");
      setBankName(autoSettings.bankName || "");
    }
  }, [autoSettings]);

  const handleToggle = (value: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEnabled(value);
  };

  const handleSelectMethod = (m: WithdrawMethod) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMethod(m);
    setAccountNumber("");
    setAccountName("");
    setBankName("");
  };

  const handleSelectFrequency = (f: Frequency) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setFrequency(f);
  };

  const handleSelectThreshold = (t: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setThreshold(t.toString());
  };

  const validateSettings = (): boolean => {
    if (!enabled) return true;

    const thresholdAmount = parseFloat(threshold);
    if (isNaN(thresholdAmount) || thresholdAmount < 50) {
      Alert.alert("Error", "Minimum threshold is K50.");
      return false;
    }

    if (!accountNumber.trim()) {
      Alert.alert("Error", "Please enter your account/phone number.");
      return false;
    }

    if (!accountName.trim()) {
      Alert.alert("Error", "Please enter the account holder name.");
      return false;
    }

    if (method === "bank" && !bankName.trim()) {
      Alert.alert("Error", "Please enter your bank name.");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateSettings()) return;

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setIsSaving(true);

    try {
      if (enabled) {
        const settings: AutoWithdrawalSettings = {
          enabled: true,
          threshold: parseFloat(threshold),
          frequency,
          method,
          accountNumber,
          accountName,
          bankName: method === "bank" ? bankName : undefined,
        };
        await saveAutoSettings(settings);
      } else {
        await clearAutoSettings();
      }

      Alert.alert(
        "Settings Saved",
        enabled
          ? `Auto-withdrawal is now enabled. When your balance exceeds K${threshold}, funds will be automatically transferred ${frequency}.`
          : "Auto-withdrawal has been disabled.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center mb-6 mt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 -ml-2"
          >
            <Text className="text-2xl">←</Text>
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Auto-Withdrawal</Text>
            <Text className="text-muted">Set up automatic transfers</Text>
          </View>
        </View>

        {/* Enable Toggle */}
        <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-foreground font-semibold text-lg">
                Enable Auto-Withdrawal
              </Text>
              <Text className="text-muted text-sm mt-1">
                Automatically transfer funds when balance exceeds threshold
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{ false: "#E5E7EB", true: "#22C55E" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {enabled && (
          <>
            {/* Threshold Selection */}
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-3">
                Threshold Amount
              </Text>
              <Text className="text-muted text-sm mb-3">
                Auto-withdraw when balance exceeds this amount
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {THRESHOLD_OPTIONS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => handleSelectThreshold(t)}
                    className={`px-4 py-3 rounded-xl border ${
                      threshold === t.toString()
                        ? "bg-primary border-primary"
                        : "bg-surface border-border"
                    }`}
                  >
                    <Text
                      className={`font-semibold ${
                        threshold === t.toString() ? "text-white" : "text-foreground"
                      }`}
                    >
                      K{t.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View className="mt-3">
                <Text className="text-muted text-sm mb-1">Or enter custom amount:</Text>
                <TextInput
                  value={threshold}
                  onChangeText={setThreshold}
                  keyboardType="numeric"
                  placeholder="Enter amount"
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholderTextColor="#9BA1A6"
                />
              </View>
            </View>

            {/* Frequency Selection */}
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-3">
                Withdrawal Frequency
              </Text>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => handleSelectFrequency(f.id)}
                  className={`flex-row items-center p-4 rounded-xl mb-2 border ${
                    frequency === f.id
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                      frequency === f.id ? "border-primary" : "border-muted"
                    }`}
                  >
                    {frequency === f.id && (
                      <View className="w-3 h-3 rounded-full bg-primary" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold">{f.name}</Text>
                    <Text className="text-muted text-sm">{f.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Payment Method */}
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-3">
                Withdrawal Method
              </Text>
              {METHODS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => handleSelectMethod(m.id)}
                  className={`flex-row items-center p-4 rounded-xl mb-2 border ${
                    method === m.id
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                  }`}
                >
                  <Text className="text-2xl mr-3">{m.icon}</Text>
                  <Text className="text-foreground font-semibold flex-1">{m.name}</Text>
                  <View
                    className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                      method === m.id ? "border-primary" : "border-muted"
                    }`}
                  >
                    {method === m.id && (
                      <View className="w-3 h-3 rounded-full bg-primary" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Account Details */}
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-3">
                Account Details
              </Text>

              <View className="mb-3">
                <Text className="text-muted text-sm mb-1">
                  {method === "bank" ? "Account Number" : "Phone Number"}
                </Text>
                <TextInput
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType={method === "bank" ? "default" : "phone-pad"}
                  placeholder={method === "bank" ? "Enter account number" : "Enter phone number"}
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholderTextColor="#9BA1A6"
                />
              </View>

              <View className="mb-3">
                <Text className="text-muted text-sm mb-1">Account Holder Name</Text>
                <TextInput
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder="Enter name as registered"
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholderTextColor="#9BA1A6"
                />
              </View>

              {method === "bank" && (
                <View className="mb-3">
                  <Text className="text-muted text-sm mb-1">Bank Name</Text>
                  <TextInput
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder="e.g., Zanaco, Stanbic, FNB"
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                    placeholderTextColor="#9BA1A6"
                  />
                </View>
              )}
            </View>

            {/* Summary */}
            <View className="bg-primary/10 rounded-xl p-4 mb-6">
              <Text className="text-primary font-semibold mb-2">Summary</Text>
              <Text className="text-muted leading-5">
                When your balance exceeds{" "}
                <Text className="text-foreground font-semibold">K{threshold}</Text>, funds will
                be automatically transferred to your{" "}
                <Text className="text-foreground font-semibold">
                  {METHODS.find((m) => m.id === method)?.name}
                </Text>{" "}
                account{" "}
                <Text className="text-foreground font-semibold">{frequency}</Text>.
              </Text>
            </View>
          </>
        )}

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className={`py-4 rounded-xl mb-8 ${
            isSaving ? "bg-primary/50" : "bg-primary"
          }`}
        >
          <Text className="text-white font-semibold text-center text-lg">
            {isSaving ? "Saving..." : "Save Settings"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
