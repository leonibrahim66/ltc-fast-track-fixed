import React, { createContext, useContext, useState, useCallback } from "react";

export interface PricingTier {
  name: string;
  minRequests: number;
  maxRequests: number;
  costPerRequest: number; // in Kwacha
  description: string;
}

export interface APIKeyCost {
  apiKeyId: string;
  apiKeyName: string;
  currentRequests: number;
  currentTier: PricingTier;
  monthlyCost: number;
  estimatedAnnualCost: number;
  projectedMonthlyRequests: number;
  projectedMonthlyCost: number;
  savingsOpportunity?: number;
}

interface APICostCalculatorContextType {
  pricingTiers: PricingTier[];
  calculateCost: (requests: number) => number;
  getCurrentTier: (requests: number) => PricingTier;
  getKeyCosts: () => APIKeyCost[];
  getProjectedCost: (apiKeyId: string, projectedRequests: number) => number;
  getTotalMonthlyCost: () => number;
  getTotalAnnualCost: () => number;
  generateCostReport: () => string;
}

const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    minRequests: 0,
    maxRequests: 1000,
    costPerRequest: 0.05,
    description: "Up to 1,000 requests/month",
  },
  {
    name: "Growth",
    minRequests: 1001,
    maxRequests: 10000,
    costPerRequest: 0.04,
    description: "1,001 - 10,000 requests/month",
  },
  {
    name: "Professional",
    minRequests: 10001,
    maxRequests: 100000,
    costPerRequest: 0.03,
    description: "10,001 - 100,000 requests/month",
  },
  {
    name: "Enterprise",
    minRequests: 100001,
    maxRequests: Infinity,
    costPerRequest: 0.02,
    description: "100,000+ requests/month",
  },
];

const APICostCalculatorContext = createContext<
  APICostCalculatorContextType | undefined
>(undefined);

export function APICostCalculatorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [keyCosts] = useState<APIKeyCost[]>([
    {
      apiKeyId: "key-001",
      apiKeyName: "Main Integration",
      currentRequests: 5000,
      currentTier: pricingTiers[1],
      monthlyCost: 200,
      estimatedAnnualCost: 2400,
      projectedMonthlyRequests: 6000,
      projectedMonthlyCost: 240,
    },
    {
      apiKeyId: "key-002",
      apiKeyName: "Partner API",
      currentRequests: 50000,
      currentTier: pricingTiers[2],
      monthlyCost: 1500,
      estimatedAnnualCost: 18000,
      projectedMonthlyRequests: 75000,
      projectedMonthlyCost: 2250,
      savingsOpportunity: 500,
    },
    {
      apiKeyId: "key-003",
      apiKeyName: "Test Environment",
      currentRequests: 500,
      currentTier: pricingTiers[0],
      monthlyCost: 25,
      estimatedAnnualCost: 300,
      projectedMonthlyRequests: 500,
      projectedMonthlyCost: 25,
    },
  ]);

  const calculateCost = useCallback((requests: number) => {
    const tier = pricingTiers.find(
      (t) => requests >= t.minRequests && requests <= t.maxRequests
    );
    if (!tier) return 0;
    return requests * tier.costPerRequest;
  }, []);

  const getCurrentTier = useCallback((requests: number) => {
    const tier = pricingTiers.find(
      (t) => requests >= t.minRequests && requests <= t.maxRequests
    );
    return tier || pricingTiers[0];
  }, []);

  const getKeyCosts = useCallback(() => {
    return keyCosts;
  }, [keyCosts]);

  const getProjectedCost = useCallback(
    (apiKeyId: string, projectedRequests: number) => {
      return calculateCost(projectedRequests);
    },
    [calculateCost]
  );

  const getTotalMonthlyCost = useCallback(() => {
    return keyCosts.reduce((sum, key) => sum + key.monthlyCost, 0);
  }, [keyCosts]);

  const getTotalAnnualCost = useCallback(() => {
    return keyCosts.reduce((sum, key) => sum + key.estimatedAnnualCost, 0);
  }, [keyCosts]);

  const generateCostReport = useCallback(() => {
    let report = "API Cost Report\n";
    report += "================\n\n";
    report += `Total Monthly Cost: K${getTotalMonthlyCost().toFixed(2)}\n`;
    report += `Total Annual Cost: K${getTotalAnnualCost().toFixed(2)}\n\n`;
    report += "API Key Breakdown:\n";
    keyCosts.forEach((key) => {
      report += `\n${key.apiKeyName}\n`;
      report += `  Current Requests: ${key.currentRequests}\n`;
      report += `  Current Tier: ${key.currentTier.name}\n`;
      report += `  Monthly Cost: K${key.monthlyCost.toFixed(2)}\n`;
      report += `  Annual Cost: K${key.estimatedAnnualCost.toFixed(2)}\n`;
      if (key.savingsOpportunity) {
        report += `  Savings Opportunity: K${key.savingsOpportunity.toFixed(2)}\n`;
      }
    });
    return report;
  }, [keyCosts, getTotalMonthlyCost, getTotalAnnualCost]);

  return (
    <APICostCalculatorContext.Provider
      value={{
        pricingTiers,
        calculateCost,
        getCurrentTier,
        getKeyCosts,
        getProjectedCost,
        getTotalMonthlyCost,
        getTotalAnnualCost,
        generateCostReport,
      }}
    >
      {children}
    </APICostCalculatorContext.Provider>
  );
}

export function useAPICostCalculator() {
  const context = useContext(APICostCalculatorContext);
  if (!context) {
    throw new Error(
      "useAPICostCalculator must be used within APICostCalculatorProvider"
    );
  }
  return context;
}
