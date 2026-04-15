import { ScrollView, Text, View, TouchableOpacity, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAPICostCalculator } from "@/lib/api-cost-calculator-context";
import { useState } from "react";

export default function APICostCalculatorScreen() {
  const {
    pricingTiers,
    getKeyCosts,
    getTotalMonthlyCost,
    getTotalAnnualCost,
    generateCostReport,
  } = useAPICostCalculator();
  const [showReport, setShowReport] = useState(false);
  const keyCosts = getKeyCosts();

  const handleGenerateReport = () => {
    const report = generateCostReport();
    Alert.alert("Cost Report", report);
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-4">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              API Cost Calculator
            </Text>
            <Text className="text-sm text-muted">
              Monitor and optimize API spending
            </Text>
          </View>

          {/* Total Cost Summary */}
          <View className="bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg p-4 border border-primary/30">
            <View className="gap-3">
              <View>
                <Text className="text-sm text-muted mb-1">Total Monthly Cost</Text>
                <Text className="text-3xl font-bold text-primary">
                  K{getTotalMonthlyCost().toFixed(2)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <View>
                  <Text className="text-xs text-muted">Annual Cost</Text>
                  <Text className="text-lg font-semibold text-foreground">
                    K{getTotalAnnualCost().toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text className="text-xs text-muted">API Keys</Text>
                  <Text className="text-lg font-semibold text-foreground">
                    {keyCosts.length}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Pricing Tiers */}
          <View className="gap-2">
            <Text className="text-lg font-semibold text-foreground">
              Pricing Tiers
            </Text>
            {pricingTiers.map((tier, index) => (
              <View key={index} className="bg-surface rounded-lg p-3 border border-border">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground">{tier.name}</Text>
                    <Text className="text-xs text-muted mt-1">
                      {tier.minRequests.toLocaleString()} -{" "}
                      {tier.maxRequests === Infinity
                        ? "Unlimited"
                        : tier.maxRequests.toLocaleString()}{" "}
                      requests/month
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-semibold text-primary">
                      K{tier.costPerRequest.toFixed(4)}/req
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      {tier.description}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* API Keys Cost Breakdown */}
          <View className="gap-2">
            <Text className="text-lg font-semibold text-foreground">
              API Keys Breakdown
            </Text>
            {keyCosts.map((key) => (
              <View key={key.apiKeyId} className="bg-surface rounded-lg p-4 border border-border">
                <View className="gap-3">
                  {/* Header */}
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">
                        {key.apiKeyName}
                      </Text>
                      <Text className="text-xs text-muted mt-1">
                        {key.apiKeyId}
                      </Text>
                    </View>
                    <View
                      className={`px-3 py-1 rounded ${
                        key.currentTier.name === "Enterprise"
                          ? "bg-primary/20"
                          : key.currentTier.name === "Professional"
                            ? "bg-success/20"
                            : "bg-warning/20"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          key.currentTier.name === "Enterprise"
                            ? "text-primary"
                            : key.currentTier.name === "Professional"
                              ? "text-success"
                              : "text-warning"
                        }`}
                      >
                        {key.currentTier.name}
                      </Text>
                    </View>
                  </View>

                  {/* Stats */}
                  <View className="grid grid-cols-2 gap-2">
                    <View className="bg-background/50 rounded p-2">
                      <Text className="text-xs text-muted">Current Requests</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {key.currentRequests.toLocaleString()}
                      </Text>
                    </View>
                    <View className="bg-background/50 rounded p-2">
                      <Text className="text-xs text-muted">Monthly Cost</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        K{key.monthlyCost.toFixed(2)}
                      </Text>
                    </View>
                    <View className="bg-background/50 rounded p-2">
                      <Text className="text-xs text-muted">Annual Cost</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        K{key.estimatedAnnualCost.toFixed(2)}
                      </Text>
                    </View>
                    <View className="bg-background/50 rounded p-2">
                      <Text className="text-xs text-muted">Projected Monthly</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        K{key.projectedMonthlyCost.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Savings Opportunity */}
                  {key.savingsOpportunity && (
                    <View className="bg-success/10 rounded p-2 border border-success/30">
                      <Text className="text-xs text-success font-semibold">
                        💰 Savings Opportunity: K{key.savingsOpportunity.toFixed(2)}
                      </Text>
                      <Text className="text-xs text-success/80 mt-1">
                        Upgrade to higher tier for better rates
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Generate Report Button */}
          <TouchableOpacity
            onPress={handleGenerateReport}
            className="bg-primary rounded-lg py-3 px-4"
          >
            <Text className="text-center font-semibold text-background">
              Generate Cost Report
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
