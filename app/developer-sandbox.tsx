import { ScrollView, Text, View, TouchableOpacity, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useSandbox } from "@/lib/sandbox-context";
import { useColors } from "@/hooks/use-colors";

export default function DeveloperSandboxScreen() {
  const colors = useColors();
  const {
    sandboxEnabled,
    setSandboxEnabled,
    sandboxPickups,
    sandboxUsers,
    sandboxPayments,
    resetSandboxData,
    getSandboxStats,
  } = useSandbox();

  const stats = getSandboxStats();

  const handleReset = () => {
    Alert.alert(
      "Reset Sandbox Data",
      "This will restore all sandbox data to default mock values. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            resetSandboxData();
            Alert.alert("Success", "Sandbox data has been reset to defaults");
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Developer Sandbox</Text>
            <Text className="text-sm text-muted">Test API endpoints with mock data</Text>
          </View>

          {/* Sandbox Toggle */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="font-semibold text-foreground">Sandbox Mode</Text>
              <TouchableOpacity
                onPress={() => setSandboxEnabled(!sandboxEnabled)}
                className={`w-14 h-8 rounded-full flex items-center justify-center ${
                  sandboxEnabled ? "bg-success" : "bg-muted"
                }`}
              >
                <View
                  className={`w-6 h-6 rounded-full bg-background ${
                    sandboxEnabled ? "ml-4" : "-ml-4"
                  }`}
                />
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-muted">
              {sandboxEnabled
                ? "Using mock data for API testing"
                : "Using production API endpoints"}
            </Text>
          </View>

          {/* Sandbox Statistics */}
          <View className="gap-3">
            <Text className="font-semibold text-foreground">Mock Data Statistics</Text>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-xl p-3 border border-border">
                <Text className="text-xs text-muted mb-1">Mock Pickups</Text>
                <Text className="text-2xl font-bold text-primary">{stats.pickups}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-xl p-3 border border-border">
                <Text className="text-xs text-muted mb-1">Mock Users</Text>
                <Text className="text-2xl font-bold text-primary">{stats.users}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-xl p-3 border border-border">
                <Text className="text-xs text-muted mb-1">Mock Payments</Text>
                <Text className="text-2xl font-bold text-primary">{stats.payments}</Text>
              </View>
            </View>
          </View>

          {/* Mock Pickups */}
          <View className="gap-2">
            <Text className="font-semibold text-foreground">Mock Pickups</Text>
            {sandboxPickups.map((pickup, idx) => (
              <View key={idx} className="bg-surface rounded-xl p-3 border border-border">
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="font-semibold text-foreground text-sm flex-1">
                    {pickup.address}
                  </Text>
                  <Text
                    className={`text-xs font-bold px-2 py-1 rounded ${
                      pickup.status === "completed"
                        ? "bg-success/20 text-success"
                        : pickup.status === "accepted"
                          ? "bg-primary/20 text-primary"
                          : "bg-warning/20 text-warning"
                    }`}
                  >
                    {pickup.status}
                  </Text>
                </View>
                <Text className="text-xs text-muted">Type: {pickup.binType}</Text>
              </View>
            ))}
          </View>

          {/* Mock Users */}
          <View className="gap-2">
            <Text className="font-semibold text-foreground">Mock Users</Text>
            {sandboxUsers.map((user, idx) => (
              <View key={idx} className="bg-surface rounded-xl p-3 border border-border">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="font-semibold text-foreground text-sm">{user.name}</Text>
                  <Text className="text-xs font-bold text-primary">{user.role}</Text>
                </View>
                <Text className="text-xs text-muted">{user.email}</Text>
              </View>
            ))}
          </View>

          {/* Mock Payments */}
          <View className="gap-2">
            <Text className="font-semibold text-foreground">Mock Payments</Text>
            {sandboxPayments.map((payment, idx) => (
              <View key={idx} className="bg-surface rounded-xl p-3 border border-border">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="font-semibold text-foreground text-sm">
                    K{payment.amount.toLocaleString()}
                  </Text>
                  <Text
                    className={`text-xs font-bold px-2 py-1 rounded ${
                      payment.status === "completed"
                        ? "bg-success/20 text-success"
                        : payment.status === "pending"
                          ? "bg-warning/20 text-warning"
                          : "bg-error/20 text-error"
                    }`}
                  >
                    {payment.status}
                  </Text>
                </View>
                <Text className="text-xs text-muted">{payment.method}</Text>
              </View>
            ))}
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            onPress={handleReset}
            className="bg-error rounded-lg py-3 px-4"
          >
            <Text className="text-center font-semibold text-background">
              Reset Sandbox Data
            </Text>
          </TouchableOpacity>

          {/* Documentation */}
          <View className="bg-surface rounded-2xl p-4 border border-border gap-2">
            <Text className="font-semibold text-foreground">Sandbox Usage</Text>
            <Text className="text-xs text-muted leading-5">
              Enable sandbox mode to test API endpoints with mock data. All requests will return
              predefined responses without affecting production data. Perfect for development and
              testing integrations.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
